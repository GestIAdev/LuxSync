# WAVE-4822 — EFFECTDREAM SURGICAL TRANSPLANT & PURGE BLUEPRINT

```
Arquitecto:   PunkOpus (Claude Sonnet 4.6)
Fecha:        2026-05-21
Branch:       v3
Predecesor:   WAVE 4821 — Genesis Migrator (48/48 .lfx ✔ 0-autofix 0-failed)
Objetivo:     Conectar el catálogo .lfx al cerebro de Selene y eliminar el código muerto
```

---

## ESTADO PRE-OPERATORIO

Tenemos dos mundos coexistiendo en RAM sin hablar entre sí:

| Mundo | Ubicación | Estado |
|---|---|---|
| **Catálogo Nuevo** | `src/core/arsenal/builtins/*.lfx` (×48) | ✅ Comprometido en disco |
| **DynamicEffectRegistry** | singleton in-memory | ❌ **VACÍO** — `loadAll()` nunca se ha llamado |
| **EffectDreamSimulator** | catálogo hardcodeado | ✅ Operativo, recluta de estructuras obsoletas |
| **EffectDNA.ts** | `EFFECT_DNA_REGISTRY` hardcodeado | ✅ Operativo, alimenta el filtro de zonas |

Sin la llamada a `loadAll()`, el Registry duerme vacío y Selene nunca ve los .lfx.
Sin el bypass del Simulator, aunque el Registry estuviera lleno, nunca lo consultaría.

---

## ANATOMÍA DEL CRIMEN: ESTRUCTURAS HARDCODEADAS EN EL SIMULATOR

He leído `EffectDreamSimulator.ts` de principio a fin. Lista negra completa:

### En la cabecera del archivo (constantes del módulo):

| Nombre | Líneas aprox. | Usado en | Tamaño |
|---|---|---|---|
| `EFFECT_CATEGORIES` | ~194–218 | `exploreAlternatives()` | 24 líneas |
| `EFFECT_BEAUTY_WEIGHTS` | ~218–345 | `projectBeauty()` (DEPRECATED WAVE 970) | ~127 líneas |
| `EFFECT_GPU_COST` | ~345–380 | `calculateRisk()` | ~35 líneas |
| `EFFECT_FATIGUE_IMPACT` | ~380–450 | `calculateRisk()` | ~70 líneas |

### Dentro del método `getVibeAllowedEffects()`:

| Nombre | Líneas aprox. | Usado en |
|---|---|---|
| `EFFECTS_BY_VIBE` (Record local) | ~700–985 | `generateCandidates()` vía este método |

### Dentro de `generateCandidates()`:

| Nombre | Tipo | Descripción |
|---|---|---|
| `STROBE_EFFECTS` | Array literal hardcodeado | Lista manual de efectos estroboscópicos |

**Total de código muerto candidato a liposucción: ~280 líneas de datos + ~50 líneas de método `projectBeauty()`**

---

## LÍNEA DE INCISIÓN 1 — LA ARTERIA DE INGESTA (APP BOOT)

### Diagnóstico del punto de arranque

La cadena de inicialización en `electron/main.ts` es:

```
app.whenReady()
  └→ license validation
      └→ createWindow() 
          └→ titanOrchestrator = new TitanOrchestrator({ dmxDriver, debug })
          └→ titanOrchestrator.setLicenseTier(currentLicenseTier)
          └→ registerTitanOrchestrator(titanOrchestrator)   ← LÍNEA ~494
          └→ await titanOrchestrator.init()                  ← LÍNEA ~496  ⬅ ZONA DE INSERCIÓN
          └→ titanOrchestrator.setBroadcastCallback(...)
          └→ titanOrchestrator.start()                       ← Motor IA arranca aquí
```

### Dónde operar

**Archivo:** `electron/main.ts`  
**Entre:** `registerTitanOrchestrator(titanOrchestrator)` y `await titanOrchestrator.init()`

Esta ventana es correcta porque:
- El main process tiene acceso total a `fs.promises` (el Loader lo necesita)
- El singleton del Registry existe desde el arranque (módulo lazy)
- `titanOrchestrator.init()` construye `TrinityBrain` y conecta los nodos de Selene — los efectos deben estar en RAM **antes** de ese momento
- `titanOrchestrator.start()` es cuando el loop de `SeleneTitanConscious` arranca a disparar — demasiado tarde para poblar el Registry

### El corte exacto (pseudocódigo, no ejecutar aún)

```typescript
// ── DESPUÉS DE: registerTitanOrchestrator(titanOrchestrator)
// ── ANTES DE:  await titanOrchestrator.init()

// ════════════════════════════════════════════════════════════
// ⚡ WAVE 4822: INFINITE ARSENAL — BOOT INGESTION
// Poblar DynamicEffectRegistry antes del primer ciclo de Selene.
// ════════════════════════════════════════════════════════════
import { LfxFileLoader } from '../src/core/arsenal/LfxFileLoader'
import { getDynamicEffectRegistry } from '../src/core/arsenal/DynamicEffectRegistry'

const _builtinPath = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar.unpacked',
               'src', 'core', 'arsenal', 'builtins')
  : path.join(__dirname, '..', 'src', 'core', 'arsenal', 'builtins')

const _lfxLoader = new LfxFileLoader(getDynamicEffectRegistry())
const _arsenalReport = await _lfxLoader.loadAll([
  { absolutePath: _builtinPath, source: 'builtin' }
])

console.log(
  `[TitanOrchestrator] ⚡ Infinite Arsenal: ` +
  `${_arsenalReport.accepted}/${_arsenalReport.scanned} .lfx cargados ` +
  `(rechazados: ${_arsenalReport.rejected}, errores: ${_arsenalReport.errors})`
)

// Aserción de salud (dev únicamente — eliminar en prod)
if (isDev) {
  console.assert(
    getDynamicEffectRegistry().getEntryCount() >= 48,
    `⚠️ Arsenal incompleto: esperados ≥48, cargados ${getDynamicEffectRegistry().getEntryCount()}`
  )
}
// ════════════════════════════════════════════════════════════

await titanOrchestrator.init()
```

### Garantía de Fallback en Boot

`LfxFileLoader` tiene política de **fallo silencioso por directiva WAVE 2483**: si un `.lfx` falta en disco, se loggea y se descarta. El resto sigue cargando. Si el directorio entero no existe (ej. build mal empaquetado), `loadAll()` devuelve un `LoadReport` con `accepted=0` y **no lanza excepción**. El sistema continúa con Registry vacío → Selene cae al path legacy → comportamiento idéntico al actual. **Cero riesgo de crash.**

---

## LÍNEA DE INCISIÓN 2 — EL BYPASS DEL SIMULADOR

Este es el corazón de la operación. Cinco incisiones quirúrgicas dentro de `EffectDreamSimulator.ts`, todas con **dual-path**: si el Registry está vacío, las funciones se comportan exactamente igual que hoy.

### INCISIÓN A — `getVibeAllowedEffects()`: El Pool de Reclutamiento

**Qué hace hoy:** Tiene un `EFFECTS_BY_VIBE: Record<string, string[]>` monolítico con todos los efectos por vibe y sus aliases hardcodeados (~285 líneas).

**Cómo se opera:**

Al inicio del método, añadir un guard que pregunte al Registry antes de entrar al bloque hardcodeado:

```typescript
private getVibeAllowedEffects(vibe: string): string[] {
  // ⚡ WAVE 4822: INFINITE ARSENAL — Dual-path routing
  const registry = getDynamicEffectRegistry()   // zero-alloc: singleton
  if (registry.getEntryCount() > 0) {
    const entries = registry.getEffectsForVibe(vibe)
    if (entries.length > 0) {
      return entries.map(e => e.id)   // string[] de ids — misma forma de retorno
    }
    // vibe desconocido → devolver todos los efectos del Registry
    return registry.getAllEntries().map(e => e.id)
  }

  // LEGACY PATH — comportamiento idéntico al actual
  const EFFECTS_BY_VIBE: Record<string, string[]> = { ... }
  // ... el resto del método sin tocar
}
```

**Qué se preserva del cerebro:** Absolutamente todo. `generateCandidates()` recibe la misma `string[]` y ejecuta los mismos filtros de zona, z-score y mood sin saber de dónde vino la lista.

### INCISIÓN B — `filterByZone()`: El Filtro de Agresión por Zona

**Qué hace hoy:** Consulta `EFFECT_DNA_REGISTRY[effect]` (importado de EffectDNA.ts) para leer `.aggression` y filtrar efectos por zona energética.

**Cómo se opera:** Lookup en cascada — Registry primero, EFFECT_DNA_REGISTRY como fallback:

```typescript
private filterByZone(effects: string[], zone: string): string[] {
  // ...aggressionLimits igual que hoy...
  const limits = aggressionLimits[zone] || { min: 0, max: 1 }
  const registry = getDynamicEffectRegistry()

  const filtered = effects.filter(effect => {
    // ⚡ WAVE 4822: Registry primero, EFFECT_DNA_REGISTRY como fallback
    const aggression = registry.getDNA(effect)?.aggression
                       ?? EFFECT_DNA_REGISTRY[effect]?.aggression
    if (aggression == null) {
      console.warn(`[DREAM_SIMULATOR] ⚠️ No DNA para: ${effect}`)
      return false
    }
    return aggression >= limits.min && aggression <= limits.max
  })
  // ...resto sin tocar...
}
```

**Qué se preserva:** La lógica de rangos por zona, el fallback de 3 efectos suavizados cuando el filtro es demasiado estricto, los logs. No se toca nada.

### INCISIÓN C — `calculateRisk()`: GPU Cost y Fatigue Impact

**Qué hace hoy:** Lee `EFFECT_GPU_COST[effect.effect]` y `EFFECT_FATIGUE_IMPACT[effect.effect]` de los objetos hardcodeados.

**Cómo se opera:** Lookup en cascada usando `getSimMeta()`:

```typescript
private calculateRisk(effect, state, context): number {
  const _registryMeta = getDynamicEffectRegistry().getSimMeta(effect.effect)

  // ⚡ WAVE 4822: Registry → hardcoded → default
  const gpuCost = _registryMeta?.gpuCost
               ?? EFFECT_GPU_COST[effect.effect as keyof typeof EFFECT_GPU_COST]
               ?? 0.15

  const fatigueImpact = _registryMeta?.fatigueImpact
                     ?? EFFECT_FATIGUE_IMPACT[effect.effect as keyof typeof EFFECT_FATIGUE_IMPACT]
                     ?? 0.05

  // ... el resto del método sin ningún cambio ...
}
```

**Qué se preserva:** Los umbrales de riesgo (0.8 high GPU, 0.6 moderate, etc.), el manejo de epilepsy mode, los cooldown conflicts, los hardware conflicts. Todo intacto.

### INCISIÓN D — `exploreAlternatives()`: El Explorador de Categorías

**Qué hace hoy:** Busca en `EFFECT_CATEGORIES` la categoría del `primaryEffect`, luego genera alternativas de esa misma categoría.

**Cómo se opera:** Usar `compatibleVibes` del RegistryEntry como proxy de categoría:

```typescript
public exploreAlternatives(primaryEffect, context): EffectCandidate[] {
  const registry = getDynamicEffectRegistry()

  // ⚡ WAVE 4822: Dual-path
  if (registry.getEntryCount() > 0) {
    const primaryEntry = registry.getEntry(primaryEffect.effect)
    if (!primaryEntry) return []

    // Los efectos del mismo vibe son los "hermanos de categoría"
    const vibe = primaryEntry.compatibleVibes[0] ?? 'techno-club'
    return registry.getEffectsForVibe(vibe)
      .filter(e => e.id !== primaryEffect.effect)
      .map(e => ({
        effect: e.id,
        intensity: primaryEffect.intensity * 0.9,
        zones: primaryEffect.zones,
        reasoning: `Alternative to ${primaryEffect.effect} (same vibe: ${vibe})`,
        confidence: primaryEffect.confidence * 0.8
      }))
  }

  // LEGACY PATH — EFFECT_CATEGORIES lookup sin cambios
  // ...código actual...
}
```

### INCISIÓN E — `generateCandidates()`: El Guard de Strobes

**Qué hace hoy:** Tiene `STROBE_EFFECTS = ['industrial_strobe', 'strobe_storm', ...]` hardcodeado para bloquear strobes cuando Z ≤ 0.

**Cómo se opera:** Leer la declaración `isStrobe` del `.lfx` vía `getSimMeta()`:

```typescript
// DENTRO DEL LOOP for (const effect of zoneFilteredEffects):

// ⚡ WAVE 4822: isStrobe desde .lfx > hardcoded list
const _simMeta = getDynamicEffectRegistry().getSimMeta(effect)
const STROBE_EFFECTS = ['industrial_strobe', 'strobe_storm', 'strobe_burst', 'ambient_strobe', 'seismic_snap']
const isStrobeEffect = _simMeta?.isStrobe ?? STROBE_EFFECTS.includes(effect)

if (isStrobeEffect && zScore <= 0) {
  continue
}
```

**Nota importante:** `_simMeta` ya se calculó arriba en INCISIÓN C. En la implementación real, calcular una vez y reutilizar en todo el loop.

---

## PRESERVACIÓN DEL CEREBRO: EL ETHICALSCORE Y EL DIVERSITY FACTOR

Nadie toca estas piezas. Aquí está la razón:

| Componente | Fuente de datos | Cambio |
|---|---|---|
| `calculateDNARelevance()` | `EFFECT_DNA_REGISTRY` + `getDNAAnalyzer()` | ❌ NO tocar en WAVE 4822 |
| `rankScenarios()` | `projectedRelevance` + `diversityScore` | ❌ NO tocar |
| `calculateDiversityScore()` | `state.lastEffect` + `state.activeCooldowns` | ❌ NO tocar |
| `generateRecommendation()` | thresholds + riskLevel | ❌ NO tocar |
| Cassandra Pre-buffer | preBuffer state machine | ❌ NO tocar |
| `simulateScenario()` | composición de todos los anteriores | ❌ NO tocar |

La arquitectura DNA (WAVE 970) que calcula `projectedRelevance` sigue usando `EFFECT_DNA_REGISTRY` de EffectDNA.ts. Eso es **WAVE 4823** (migración de DNA al Registry). Por ahora no tocamos esa capa.

---

## EL PLAN DE LIPOSUCCIÓN — LA PURGA ESTRUCTURADA

### Fase 1 (WAVE 4822): Las cinco incisiones quirúrgicas arriba

Solo añadir dual-path guards. **Cero eliminaciones todavía.**

### Fase 2 (WAVE 4823): Purga de datos GPU/Fatigue/GPU

Una vez que los tests confirmen que el Registry sirve los datos correctamente:

```
ARCHIVOS A LIMPIAR:
  EffectDreamSimulator.ts
    - Eliminar const EFFECT_GPU_COST         (~35 líneas)
    - Eliminar const EFFECT_FATIGUE_IMPACT   (~70 líneas)  
    - Eliminar const EFFECT_BEAUTY_WEIGHTS   (~127 líneas)
    - Eliminar método projectBeauty()        (~35 líneas)
```

### Fase 3 (WAVE 4824): Purga del pool de reclutamiento

Una vez que `getVibeAllowedEffects()` esté demostrado funcionando con el Registry:

```
ARCHIVOS A LIMPIAR:
  EffectDreamSimulator.ts
    - Eliminar const EFFECT_CATEGORIES      (~24 líneas)
    - Eliminar bloque EFFECTS_BY_VIBE       (~285 líneas en getVibeAllowedEffects)
    - Eliminar STROBE_EFFECTS hardcoded      (~1 línea)
    - Reducir método getVibeAllowedEffects() a ~15 líneas
```

### Fase 4 (WAVE 4825): Migración del DNA al Registry y purga de EffectDNA.ts

La más invasiva — requiere migrar `filterByZone()` y `calculateDNARelevance()`:

```
ARCHIVOS A EVALUAR:
  EffectDNA.ts
    - Evaluar qué de EFFECT_DNA_REGISTRY está ya en .lfx cognitiveDNA.genome
    - Los campos que ESTÁN en .lfx → eliminar de EFFECT_DNA_REGISTRY
    - Mantener WILDCARD_EFFECTS y DNAAnalyzer (lógica, no datos)
```

### Estrategia de contingencia de archivos

**Antes de cada purga**: mover los objetos eliminados a `src/core/arsenal/_legacy_archive/` como módulos TypeScript comentados. No borrar hasta confirmar 2 semanas de producción sin regresiones.

---

## MAPA DE FALLBACKS: SI UN .LFX FALTA EN DISCO

El sistema tiene N capas de red:

```
Selene solicita efecto "clave_rhythm"
  │
  ├─→ Registry.getEntry("clave_rhythm")
  │      ├─ HIT  → sirve datos desde RAM (O(1)) ✅
  │      └─ MISS →
  │              ├─→ EFFECT_DNA_REGISTRY["clave_rhythm"]  ← legacy fallback
  │              │      ├─ HIT  → sistema funciona en modo legacy ⚠️ degradado
  │              │      └─ MISS → console.warn + return 0.5 neutral ❌ inerte
  │
  └─→ Selene sigue adelante con el siguiente candidato
```

El Simulator nunca crashea por un efecto ausente. En el peor caso, ese efecto queda inerte (nunca seleccionado) y Selene elige el siguiente de la lista.

Si el directorio completo de builtins falta:
```
loadAll() → scanned=0, accepted=0, rejected=0, errors=0
getDynamicEffectRegistry().getEntryCount() === 0
getVibeAllowedEffects() → cae al LEGACY PATH completo
Sistema: idéntico al comportamiento PRE-WAVE 4822
```

---

## PROTOCOLO DE VERIFICACIÓN E2E — FASE DE DESPERTAR

### Gate 1: Compilación TypeScript (antes de arrancar nada)

```powershell
cd electron-app
npx tsc --noEmit
```

Verificar que no hay errores de tipo en las importaciones de `LfxFileLoader` y `getDynamicEffectRegistry` desde `electron/main.ts`.

### Gate 2: Log de salud en arranque (runtime check)

Después del `loadAll()` en main.ts, buscar en la consola del main process:

```
[TitanOrchestrator] ⚡ Infinite Arsenal: 48/48 .lfx cargados (rechazados: 0, errores: 0)
```

Si el número es < 48, revisar cuáles fallaron con el log de LfxFileLoader (`[LFX_LOADER]`).

### Gate 3: Aserción de Registry (dev mode)

El bloque `isDev` que hemos añadido lanza un assertion en consola si `getEntryCount() < 48`. Es visible inmediatamente al arrancar.

### Gate 4: Verificar que Selene usa el nuevo pool

Con la app corriendo y audio en vivo, buscar en logs:

```
[DREAM_SIMULATOR] 🎯 clave_rhythm (Xms)          ← viene del nuevo pool
```

vs el comportamiento legacy (mismos nombres de efecto, diferente origen).

Temporarily añadir un log trace en `getVibeAllowedEffects()`:

```typescript
if (registry.getEntryCount() > 0) {
  console.log('[DREAM_SIMULATOR] 🆕 REGISTRY PATH activo — pool size:', entries.length)
  return entries.map(e => e.id)
}
console.log('[DREAM_SIMULATOR] ⚠️ LEGACY PATH — registry vacío')
```

Debe aparecer `REGISTRY PATH activo` en todos los frames de decisión.

### Gate 5: Dry-run antes de start() (opcional — alto valor)

Añadir en main.ts, DESPUÉS de `titanOrchestrator.init()` y ANTES de `titanOrchestrator.start()`:

```typescript
if (isDev) {
  // Verificar que el Simulator puede generar candidatos del nuevo catálogo
  const { effectDreamSimulator } = await import('../src/core/intelligence/dream/EffectDreamSimulator')
  const testResult = await effectDreamSimulator.dreamEffects(
    { vibe: 'fiesta-latina', currentBeauty: 0.5, lastEffect: null, activeCooldowns: new Set(), energy: 0.6, tempo: 128 },
    { predictedEnergy: 0.6, confidence: 0.8, predictionType: 'none', timeToEventMs: 4000, isUrgent: false, oracleProbability: 0.5 },
    { vibe: 'fiesta-latina', energy: 0.6, /* ...campos mínimos requeridos... */ } as any
  )
  console.log('[WAVE 4822 E2E] Dry-run:', testResult.bestScenario?.effect.effect, '| rec:', testResult.recommendation)
}
```

---

## RESUMEN EJECUTIVO: EL MAPA DE CABLES

```
BOOT SEQUENCE (electron/main.ts)
─────────────────────────────────────────────────────────────
app.whenReady()
  │
  ├── [1] new TitanOrchestrator()
  ├── [2] setLicenseTier()
  ├── [3] registerTitanOrchestrator()
  │
  ├── ⚡ [4] «WAVE 4822: NUEVO» LfxFileLoader.loadAll(builtins/)
  │          → DynamicEffectRegistry.getEntryCount() === 48
  │
  ├── [5] await titanOrchestrator.init()   ← Selene construye su cerebro
  └── [6] titanOrchestrator.start()        ← Loop IA arranca

SELENE DECISION LOOP (EffectDreamSimulator)
─────────────────────────────────────────────────────────────
dreamEffects()
  │
  ├── generateCandidates()
  │     └── getVibeAllowedEffects(vibe)
  │           ├── «WAVE 4822» Registry.getEffectsForVibe(vibe) → string[]
  │           └── [fallback] EFFECTS_BY_VIBE[vibe] (legacy)
  │
  ├── filterByZone(effects, zone)
  │     └── «WAVE 4822» Registry.getDNA(effect)?.aggression 
  │               ?? EFFECT_DNA_REGISTRY[effect]?.aggression
  │
  ├── simulateScenario(candidate)
  │     ├── calculateRisk()
  │     │     └── «WAVE 4822» Registry.getSimMeta(effect)?.gpuCost
  │     │                   ?? EFFECT_GPU_COST[effect]
  │     │     └── «WAVE 4822» Registry.getSimMeta(effect)?.fatigueImpact
  │     │                   ?? EFFECT_FATIGUE_IMPACT[effect]
  │     └── calculateDNARelevance()  ← SIN TOCAR (WAVE 4823+)
  │
  └── exploreAlternatives()
        ├── «WAVE 4822» Registry: compatibleVibes → getEffectsForVibe()
        └── [fallback] EFFECT_CATEGORIES (legacy)

PURGE SCHEDULE
─────────────────────────────────────────────────────────────
WAVE 4822 → Solo dual-path guards (cero eliminaciones)
WAVE 4823 → Purga EFFECT_GPU_COST / EFFECT_FATIGUE_IMPACT / EFFECT_BEAUTY_WEIGHTS
WAVE 4824 → Purga EFFECT_CATEGORIES / EFFECTS_BY_VIBE 
WAVE 4825 → Migración DNA + purga de EFFECT_DNA_REGISTRY (lo más delicado)
```

---

## LO QUE ESTE BLUEPRINT NO HACE

Para que quede claro lo que está fuera de alcance de WAVE 4822:

- ❌ No migra `calculateDNARelevance()` — sigue usando `EFFECT_DNA_REGISTRY` de EffectDNA.ts
- ❌ No toca `VisualConscienceEngine`, `DecisionMaker`, `HuntEngine`
- ❌ No cambia el formato de los `.lfx` — ya tienen `gpuCost` y `fatigueImpact` en `simulationMeta`
- ❌ No implementa hot-reload de efectos de usuario (rutas de usuario son WAVE 4830+)
- ❌ No purga nada todavía — WAVE 4822 solo añade los dual-path guards

---

*PunkOpus — WAVE 4822 Surgical Transplant Blueprint — 0 líneas de código generadas, 100% de cables mapeados.*
