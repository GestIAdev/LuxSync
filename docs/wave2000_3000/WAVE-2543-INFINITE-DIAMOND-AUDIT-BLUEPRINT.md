# 💎 WAVE 2543: INFINITE DIAMOND — AUDIT & BLUEPRINT

**Fecha**: 2026-04-10  
**Ejecutor**: PunkOpus (Lead Developer / Auditoría Estructural)  
**Solicitante**: Radwulf (Dirección de Arquitectura)  
**Estado**: 📋 AUDITORÍA COMPLETA — BLUEPRINT APROBADO PARA EJECUCIÓN

---

## ═══════════════════════════════════════════════════════════════════════
## PARTE I: RESULTADOS DE LA AUDITORÍA
## ═══════════════════════════════════════════════════════════════════════

---

### 🔺 VÉRTICE 1: HEPHAESTUS (Exportación .lfx)

**Archivos auditados:**
- `src/core/hephaestus/types.ts` — `serializeHephClip()` (L510-530)
- `src/core/hephaestus/HephFileIO.ts` — `saveClip()` (L156-185)
- `src/core/hephaestus/HephIPCHandlers.ts` — `ipcMain.handle('heph:save')` (L43-88)
- `src/core/effects/types.ts` — `EffectZone` type (L64-77)
- `src/core/stage/ShowFileV2.ts` — `CANONICAL_ZONES`, `normalizeZone()` (L264-301)

**Hallazgos:**

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| Campo `zones` en .lfx | ✅ PRESERVADO | `serializeHephClip()` escribe `zones: clip.zones as string[]` directamente |
| Zonas canónicas WAVE 2040.26 | ✅ RESPETADAS | 42 efectos migrados, `normalizeZone()` maneja legacy |
| Tipo `EffectZone` | ✅ CORRECTO | Unión de `CanonicalZone` (9) + helpers (`all`, `all-movers`, `all-pars`, `all-left`, `all-right`) + stereo (`frontL/R`, `backL/R`, `floorL/R`) |
| Serialización | ✅ DETERMINISTA | Record<> (no Map<>), SHA-256 checksum, sin random |

**Veredicto Hephaestus: 🟢 SIN DEFECTOS**

El campo `zones` viaja intacto del efecto → serialización → archivo .lfx. Los strings son canónicos post-WAVE 2040.26. No hay pérdida de datos en este vértice.

---

### 🔺 VÉRTICE 2: CHRONOS (Ingesta, Tracks y Pipeline)

**Archivos auditados:**
- `src/chronos/core/TimelineClip.ts` — `FXClip`, `createHephFXClip()` (L155-600)
- `src/chronos/core/TimelineClip.ts` — `DragPayload` (L649-710)
- `src/chronos/hooks/useTimelineClips.ts` — `createClipFromDrop()` (L211-270)
- `src/chronos/ui/timeline/TimelineCanvas.tsx` — `DEFAULT_TRACKS` (L108-121)
- `src/chronos/core/types.ts` — `TimelineTrack`, `TrackType`, `createDefaultTrack()` (L162-996)
- `src/chronos/core/ChronosProject.ts` — `luxToChronos()` (L406-470)
- `src/chronos/store/chronosStore.ts` — `addTrack()`, `deleteTrack()` (L407-470)

**Hallazgos:**

#### 2.1 — El campo `zones` SOBREVIVE la ingesta ✅

La cadena completa preserva zones:

```
DragPayload.zones ─────→ createHephFXClip(zones) ─────→ FXClip.zones
     (string[])                (parámetro)                 (string[])
```

`FXClip.zones?: string[]` almacena las zonas del efecto original. Se preserva en la serialización `.lux` porque `FXClip` se serializa via `JSON.stringify`. **No hay aplastamiento.**

#### 2.2 — Los Tracks están HARDCODEADOS por MixBus, NO por Zona ⚠️

```typescript
// TimelineCanvas.tsx L108-121 — Tracks fijos
const DEFAULT_TRACKS: Track[] = [
  { id: 'ruler',    type: 'ruler',    label: 'TIME',     height: 32 },
  { id: 'waveform', type: 'waveform', label: 'AUDIO',    height: 64 },
  { id: 'vibe',     type: 'vibe',     label: 'VIBE',     height: 32 },
  { id: 'fx1',      type: 'fx',       label: 'GLOBAL',   height: 40 },  // mixBus: global
  { id: 'fx2',      type: 'fx',       label: 'MOVEMENT', height: 40 },  // mixBus: htp
  { id: 'fx3',      type: 'fx',       label: 'AMBIENT',  height: 36 },  // mixBus: ambient
  { id: 'fx4',      type: 'fx',       label: 'ACCENT',   height: 32 },  // mixBus: accent
]
```

**Problema**: Las 4 pistas FX representan *categorías de MixBus*, no *destinos físicos*. Un efecto en `fx2 (MOVEMENT)` puede tener `zones: ['all-pars']` pero también podría tener `zones: ['movers-left']`. El trackId no tiene relación con la zona — es puramente visual por prioridad de mezcla.

#### 2.3 — Hay DOS sistemas de tracks paralelos incompatibles ⚠️

| Sistema | Archivo | Modelo | Uso |
|---------|---------|--------|-----|
| **TimelineCanvas (Visual)** | `TimelineCanvas.tsx` | `Track { id, type, label, height, color }` | Renderizado del canvas 2D |
| **ChronosProject (Runtime)** | `chronos/core/types.ts` | `TimelineTrack { id, type, name, enabled, solo, locked, ...clips[] }` | Persistencia + Runtime |

El visual usa un array local `DEFAULT_TRACKS` mientras el runtime usa `RuntimeProject.tracks[]`. Están desacoplados — los clips referencian `trackId` que coincide con los IDs del canvas visual (`fx1`, `fx2`, etc.), pero `ChronosProject.tracks[]` usa IDs generados dinámicamente.

**Cuando se carga un `.lux` con `luxToChronos()`:** TODOS los clips se meten en un solo track genérico con ID aleatorio. Los `trackId` originales se sobreescriben.

#### 2.4 — NO hay track "por zona" — todo clip FX apunta a MixBus

Al hacer drag-and-drop de un .lfx:
1. El clip cae en el track visual donde el usuario lo suelta (fx1-fx4)
2. El `trackId` se asigna al track visual destino
3. El campo `zones` del clip queda intacto PERO no determina el track
4. En playback, `TimelineEngine.resolveFixtureIds()` intenta resolver `zones` → **FALLA** (wildcard)

**Veredicto Chronos: 🟡 FUNCIONAL CON QUIEBRES DE DISEÑO**

Los datos están intactos (zones sobrevive), pero la arquitectura de tracks es un MixBus router, no un Zone router. Para "Infinite Diamond" necesitamos tracks = destinos físicos.

---

### 🔺 VÉRTICE 3: HYPERION / TimelineEngine (Playback)

**Archivos auditados:**
- `src/core/engine/TimelineEngine.ts` — `resolveFixtureIds()` (L1046-1068)
- `src/core/engine/TimelineEngine.ts` — `processHephClip()` (L828-920)
- `src/core/engine/TimelineEngine.ts` — Todos los callsites de `resolveFixtureIds` (L570, L607, L914, L992)
- `src/core/arbiter/MasterArbiter.ts` — `getFixtureIdsByZone()` (L328-390)
- `src/core/orchestrator/TitanOrchestrator.ts` — `fixtureMatchesZone()` (L2301-2370)

**Hallazgo CRÍTICO — LA FRACTURA:**

```typescript
// TimelineEngine.ts L1046-1068 — resolveFixtureIds()
private resolveFixtureIds(clip: FXClip): string[] {
    const zones = clip.zones

    if (zones && zones.length > 0) {
      if (zones.includes('all') || zones.includes('*')) {
        return masterArbiter.getFixtureIds()  // ← OK
      }

      // 🚑 FALLBACK DE EMERGENCIA — AQUÍ ESTÁ EL BUG
      console.warn(
        `⚠️ Zone mapping not implemented for zones: ${zones.join(', ')} — falling back to wildcard '*'`
      )
    }

    return masterArbiter.getFixtureIds()  // ← TODO va a TODOS los fixtures
}
```

**El método `resolveFixtureIds()` NO HACE NADA con las zonas que no sean 'all' o '*'.** Cualquier zona canónica (`all-pars`, `front`, `movers-left`, etc.) cae al warning → wildcard.

**MIENTRAS TANTO:** `MasterArbiter.getFixtureIdsByZone()` (L328-390) **YA RESUELVE TODAS LAS ZONAS CANÓNICAS CORRECTAMENTE:**
- `all-pars` → `['front', 'back', 'floor']` → fixture IDs reales
- `all-movers` → `['movers-left', 'movers-right']` → fixture IDs reales
- Zonas directas: `front` → fixtures con zone `front`
- Legacy: `normalizeZone()` normaliza formatos obsoletos
- Fallback: Si resuelve 0 → wildcard (seguridad)

**La solución es trivial:** `resolveFixtureIds()` debe delegar a `masterArbiter.getFixtureIdsByZone()` en lugar de rendirse. La función ya existe, solo falta conectarla.

**Callsites afectados** (4 lugares que llaman `resolveFixtureIds`):
1. L570 — procesamiento de efectos con `EffectFrameOutput.zoneOverrides` (ya usa `getFixtureIdsByZone` por separado en L744 ← inconsistencia)
2. L607 — procesamiento global de efectos
3. L914 — `processHephClip()` → Hephaestus Diamond clips
4. L992 — Legacy FX types

**NOTA IMPORTANTE:** La línea 744 del mismo archivo ya usa `masterArbiter.getFixtureIdsByZone(zoneId)` para el dispatch de `zoneOverrides`. Esto significa que el sistema FUNCIONA para efectos que usan `zoneOverrides` internamente, pero FALLA para el campo `FXClip.zones` que es lo que Chronos envía.

**Veredicto Hyperion: 🔴 BUG CONFIRMADO — CONEXIÓN ROTA**

El resolver de zonas existe y funciona (`MasterArbiter.getFixtureIdsByZone`). El consumer de zonas existe y tiene los datos (`FXClip.zones`). Pero `TimelineEngine.resolveFixtureIds()` no conecta A con B.

---

## ═══════════════════════════════════════════════════════════════════════
## PARTE II: DIAGNÓSTICO COMPLETO DEL PIPELINE DIAMOND
## ═══════════════════════════════════════════════════════════════════════

### 📊 Flujo actual del dato `zones` a través del pipeline:

```
HEPHAESTUS                CHRONOS                    HYPERION (TimelineEngine)
─────────                 ───────                    ────────────────────────
Effect.zones              DragPayload.zones          FXClip.zones
  ['all-pars']    ──→       ['all-pars']     ──→       ['all-pars']
       ↓                       ↓                           ↓
serializeHephClip()       createHephFXClip()         resolveFixtureIds()
  zones: ['all-pars']      zones: ['all-pars']          ⚠️ WARN: not implemented
       ↓                       ↓                           ↓
   .lfx file              FXClip en Timeline          ❌ WILDCARD ['*']
                                                      (ilumina TODO en vez de PARs)
```

### 🔍 Resumen de fracturas:

| # | Fractura | Severidad | Componente |
|---|----------|-----------|------------|
| F1 | `resolveFixtureIds()` ignora zonas y cae a wildcard | 🔴 CRÍTICA | TimelineEngine.ts |
| F2 | Tracks hardcodeados por MixBus, no por destino | 🟡 DISEÑO | TimelineCanvas.tsx |
| F3 | Dos modelos de Track paralelos (visual vs runtime) | 🟡 DISEÑO | TimelineCanvas/types.ts |
| F4 | `luxToChronos()` aplasta trackIds en un solo track | 🟠 FUNCIONAL | ChronosProject.ts |

---

## ═══════════════════════════════════════════════════════════════════════
## PARTE III: BLUEPRINT DE SOLUCIÓN — INFINITE DIAMOND
## ═══════════════════════════════════════════════════════════════════════

---

### 🔧 FASE 1: HOTFIX — Conectar resolveFixtureIds() con MasterArbiter (WAVE 2543.1)

**Impacto:** Resuelve F1 inmediatamente. Cero riesgo de regresión.

**Cambio único** en `TimelineEngine.ts` → `resolveFixtureIds()`:

```typescript
private resolveFixtureIds(clip: FXClip): string[] {
    const zones = clip.zones

    if (zones && zones.length > 0) {
      // Wildcard check
      if (zones.includes('all') || zones.includes('*')) {
        return masterArbiter.getFixtureIds()
      }

      // WAVE 2543.1: Resolve via MasterArbiter — supports ALL canonical zones
      const resolved: string[] = []
      for (const zone of zones) {
        const ids = masterArbiter.getFixtureIdsByZone(zone)
        for (const id of ids) {
          if (!resolved.includes(id)) resolved.push(id)
        }
      }

      if (resolved.length > 0) return resolved

      // Safety fallback: if all zones resolved to 0 fixtures, use all
      console.warn(
        `[TimelineEngine] ⚠️ Zones ${zones.join(', ')} resolved to 0 fixtures — fallback to all`
      )
    }

    return masterArbiter.getFixtureIds()
}
```

**Archivos tocados:** 1 (`TimelineEngine.ts`)  
**Líneas cambiadas:** ~20  
**Tests necesarios:** Ejecutar playback con clip zones `['all-pars']` → verificar que solo PARs se iluminan.

---

### 🔧 FASE 2: Estandarizar Diamond Data — Campo `target` (WAVE 2543.2)

**Objetivo:** El nodo Diamond Data (`hephClip` dentro de `FXClip`) debe tener un campo `target` explícito que consolide la intención de destino.

**Propuesta de estructura:**

```typescript
// Nuevo campo en HephAutomationClipSerialized
interface HephAutomationClipSerialized {
  // ... campos existentes ...
  zones: string[]           // ← YA EXISTE (preservar como canonical zones)
  
  // NUEVO: Target descriptor unificado
  target: DiamondTarget
}

interface DiamondTarget {
  /** Modo de targeting */
  mode: 'zone' | 'group' | 'fixture' | 'all'
  
  /** IDs de zona canónica (cuando mode='zone') */
  zones: EffectZone[]
  
  /** IDs de grupo del stage (cuando mode='group') */
  groupIds?: string[]
  
  /** IDs de fixture explícitos (cuando mode='fixture') */
  fixtureIds?: string[]
}
```

**Beneficios:**
- Backwards-compatible: `zones` sigue existiendo para clips legacy
- Extensible: `groupIds` permite targeting por grupo del StageBuilder
- Explícito: `mode` elimina ambigüedad entre "vacío = all" vs "vacío = no data"
- Determinista: Nunca inferimos — el usuario declara el target

**Archivos tocados:**
1. `src/core/hephaestus/types.ts` — Agregar `DiamondTarget` interface
2. `src/core/hephaestus/types.ts` — Agregar campo `target` a `HephAutomationClipSerialized`
3. `src/chronos/core/TimelineClip.ts` — `FXClip.target?: DiamondTarget`
4. `src/core/engine/TimelineEngine.ts` — `resolveFixtureIds()` lee `target` primero, fallback a `zones`
5. Migración: clips sin `target` se infieren desde `zones` (backwards compat)

---

### 🔧 FASE 3: Tracks Infinitos por Destino (WAVE 2543.3) — THE BIG ONE

**Objetivo:** Reemplazar las 4 pistas FX fijas (GLOBAL, MOVEMENT, AMBIENT, ACCENT) por un sistema de pistas dinámicas donde cada Track apunta a una Zona Física.

#### 3.1 — Nuevo modelo de Track

```typescript
// Evolución de TimelineTrack
interface TimelineTrack {
  // ... campos existentes (id, name, type, enabled, solo, locked, height, color) ...
  
  // NUEVO: Zona de destino (solo para tracks tipo 'fx')
  targetZone?: EffectZone    // 'front', 'all-pars', 'movers-left', etc.
  
  // PRESERVAR: MixBus como propiedad de mezcla (HTP/LTP), NO como identity
  mixBus?: 'global' | 'htp' | 'ambient' | 'accent'
}
```

**Concepto clave:** El `targetZone` define DÓNDE va la luz. El `mixBus` define CÓMO se mezcla con las demás capas. Son ortogonales.

#### 3.2 — Tracks dinámicos en TimelineCanvas

Reemplazar `DEFAULT_TRACKS` hardcodeado por un sistema reactivo:

```typescript
// Tracks base (siempre presentes)
const STRUCTURAL_TRACKS: Track[] = [
  { id: 'ruler',    type: 'ruler',    label: 'TIME',  height: 32 },
  { id: 'waveform', type: 'waveform', label: 'AUDIO', height: 64 },
  { id: 'vibe',     type: 'vibe',     label: 'VIBE',  height: 32 },
]

// Tracks de zona se generan desde el Stage actual
function generateZoneTracks(fixtures: FixtureV2[]): Track[] {
  const activeZones = new Set(fixtures.map(f => normalizeZone(f.zone)))
  
  const ZONE_TRACK_CONFIG: Record<string, { label: string; color: string; height: number }> = {
    'front':        { label: '🔴 FRONT PARS',   color: '#ef4444', height: 36 },
    'back':         { label: '🔵 BACK PARS',    color: '#3b82f6', height: 36 },
    'floor':        { label: '⬇️ FLOOR',        color: '#10b981', height: 32 },
    'movers-left':  { label: '🏎️ MOVER L',     color: '#f59e0b', height: 40 },
    'movers-right': { label: '🏎️ MOVER R',     color: '#fbbf24', height: 40 },
    'center':       { label: '⚡ CENTER',       color: '#a855f7', height: 36 },
    'air':          { label: '✨ AIR',          color: '#22d3ee', height: 32 },
    'ambient':      { label: '🌫️ AMBIENT',     color: '#6b7280', height: 32 },
  }
  
  return Array.from(activeZones)
    .filter(z => z !== 'unassigned')
    .sort((a, b) => /* orden visual coherente */)
    .map((zone, i) => ({
      id: `zone-${zone}`,
      type: 'fx' as const,
      label: ZONE_TRACK_CONFIG[zone]?.label ?? zone.toUpperCase(),
      color: ZONE_TRACK_CONFIG[zone]?.color ?? '#6b7280',
      height: ZONE_TRACK_CONFIG[zone]?.height ?? 36,
      targetZone: zone,
    }))
}
```

**Resultado visual:**
```
┌──────────────────────────────────────────────────────────────┐
│  TIME          │░░░░░░░░█░░░░░░░░░░░░█░░░░░░░░│             │
│  AUDIO         │▁▂▃█▇▅▃▂▁▂▄█▇▅▃▂▁▅▇█▅▃▂▁▂▃▄█│             │
│  VIBE          │████ TECHNO █████│██ CHILL ████│             │
├──────────────────────────────────────────────────────────────┤← Zona dinámica
│ 🔴 FRONT PARS │    [Color Wash]    [Pulse]     │             │
│ 🔵 BACK PARS  │         [Digital Rain]         │             │
│ 🏎️ MOVER L   │  [Sweep Left]          [Chase] │             │
│ 🏎️ MOVER R   │  [Sweep Right]         [Chase] │             │
│ ⚡ CENTER      │            [Strobe]            │             │
│ ✨ AIR         │    [Fog Burst]                 │             │
└──────────────────────────────────────────────────────────────┘
```

#### 3.3 — Track Groups (Metacomandos)

Para casos comunes, permitir que un clip cubra GRUPOS de zonas:

```
[ALL-PARS track] → Resuelve a front + back + floor simultáneamente
[ALL-MOVERS track] → Resuelve a movers-left + movers-right
```

Los tracks compuestos se crean con "Add Track → all-pars" y actúan como shortcuts sobre el canvas.

#### 3.4 — Auto-routing al hacer Drop

Cuando un clip .lfx se dropea en el timeline:

1. **Si tiene `zones`**: Auto-crear tracks si no existen para esas zonas, colocar en el correcto
2. **Si el usuario lo suelta en un track específico**: Respetar la decisión del usuario (override)
3. **Si no tiene `zones`**: Colocar en un track "ALL" genérico (backwards compat)

```typescript
function resolveDropTrack(payload: DragPayload, dropTrackId: string | null): string {
  // Si el usuario eligió el track explícitamente, respetar
  if (dropTrackId) return dropTrackId
  
  // Auto-route por zona del efecto
  const clipZones = payload.zones ?? payload.hephClipSerialized?.zones ?? []
  if (clipZones.length === 1) {
    return `zone-${clipZones[0]}`  // Track único por zona
  }
  if (clipZones.length > 1) {
    return `zone-${clipZones[0]}`  // Primary zone (primera)
  }
  
  return 'zone-all'  // Fallback: track global
}
```

#### 3.5 — Migración de proyectos legacy

Para `.lux` files existentes con clips en tracks `fx1-fx4`:

```typescript
function migrateTrackSystem(project: LuxProject): LuxProject {
  const LEGACY_TRACK_MAP: Record<string, string> = {
    'fx1': 'zone-all',          // GLOBAL → all fixtures
    'fx2': 'zone-all-movers',   // MOVEMENT → movers
    'fx3': 'zone-all',          // AMBIENT → all (atmospheric)
    'fx4': 'zone-all',          // ACCENT → all (short hits)
  }
  
  // Remap trackIds, pero preservar zones del clip si existen
  for (const clip of project.timeline.clips) {
    if (clip.zones?.length) {
      clip.trackId = `zone-${clip.zones[0]}`
    } else {
      clip.trackId = LEGACY_TRACK_MAP[clip.trackId] ?? 'zone-all'
    }
  }
  
  return project
}
```

---

### 🔧 FASE 4: ZoneMapper Centralizado (WAVE 2543.4)

**Objetivo:** Un módulo compartido entre Chronos, Hyperion y el Arbiter que sea la fuente única de verdad para zone ↔ fixture resolution.

**Ubicación propuesta:** `src/core/zones/ZoneMapper.ts`

```typescript
/**
 * ZoneMapper — Single Source of Truth para resolución de zonas
 * 
 * Consumido por:
 *   - TimelineEngine.resolveFixtureIds() (Hyperion playback)
 *   - TitanOrchestrator.fixtureMatchesZone() (Selene live)
 *   - TimelineCanvas.generateZoneTracks() (Chronos UI)
 *   - MasterArbiter.getFixtureIdsByZone() (DMX routing)
 */

export interface ZoneMapperConfig {
  fixtures: ReadonlyArray<{ id: string; zone: string; position?: { x: number } }>
}

export class ZoneMapper {
  private fixturesByCanonical = new Map<string, string[]>()
  
  constructor(config: ZoneMapperConfig) {
    this.rebuild(config)
  }
  
  rebuild(config: ZoneMapperConfig): void {
    this.fixturesByCanonical.clear()
    for (const f of config.fixtures) {
      const canonical = normalizeZone(f.zone)
      if (!this.fixturesByCanonical.has(canonical)) {
        this.fixturesByCanonical.set(canonical, [])
      }
      this.fixturesByCanonical.get(canonical)!.push(f.id)
    }
  }
  
  resolve(zone: EffectZone): string[] {
    const z = zone.toLowerCase()
    
    if (z === 'all' || z === '*') return this.getAllIds()
    
    // Composites
    const COMPOSITES: Record<string, string[]> = {
      'all-pars':   ['front', 'back', 'floor'],
      'all-movers': ['movers-left', 'movers-right'],
      'all-left':   [], // Position-based: needs special handling
      'all-right':  [], // Position-based: needs special handling
    }
    
    const targets = COMPOSITES[z] ?? [z]
    const result: string[] = []
    
    for (const t of targets) {
      const ids = this.fixturesByCanonical.get(t)
      if (ids) result.push(...ids)
    }
    
    return result
  }
  
  resolveMultiple(zones: EffectZone[]): string[] {
    const seen = new Set<string>()
    const result: string[] = []
    for (const zone of zones) {
      for (const id of this.resolve(zone)) {
        if (!seen.has(id)) {
          seen.add(id)
          result.push(id)
        }
      }
    }
    return result
  }
  
  getActiveZones(): string[] {
    return Array.from(this.fixturesByCanonical.keys())
      .filter(z => z !== 'unassigned')
  }
  
  getFixtureCount(zone: string): number {
    return this.fixturesByCanonical.get(zone)?.length ?? 0
  }
  
  private getAllIds(): string[] {
    const all: string[] = []
    for (const ids of this.fixturesByCanonical.values()) all.push(...ids)
    return all
  }
}
```

**Integración:**
- `MasterArbiter.getFixtureIdsByZone()` → Delega a `ZoneMapper.resolve()`
- `TitanOrchestrator.fixtureMatchesZone()` → Delega a `ZoneMapper.resolve()` + `.includes()`
- `TimelineEngine.resolveFixtureIds()` → Delega a `ZoneMapper.resolveMultiple()`
- Se reconstruye cuando el Stage cambia (`stageStore.subscribe()`)

---

## ═══════════════════════════════════════════════════════════════════════
## PARTE IV: PLAN DE EJECUCIÓN SECUENCIAL
## ═══════════════════════════════════════════════════════════════════════

```
WAVE 2543.1 — HOTFIX resolveFixtureIds()
   │  Riesgo: BAJO | Impacto: INMEDIATO | LOC: ~20
   │  Conecta resolveFixtureIds → masterArbiter.getFixtureIdsByZone
   │  TEST: Playback con clip zones=['all-pars'] → solo PARs iluminan
   │
   ▼
WAVE 2543.2 — DiamondTarget estandarizado
   │  Riesgo: BAJO | Impacto: MEDIO | LOC: ~80
   │  Nuevo type DiamondTarget, campo optional en HephAutomationClipSerialized
   │  Backwards compat: clips sin target usan zones como fallback
   │  TEST: Serializar/deserializar .lfx con target → roundtrip OK
   │
   ▼
WAVE 2543.3 — Tracks Infinitos por Destino (Chronos)
   │  Riesgo: MEDIO | Impacto: ALTO | LOC: ~300-500
   │  Reescribir DEFAULT_TRACKS → generateZoneTracks(fixtures)
   │  Track reactivos al StageStore
   │  Auto-routing en drop
   │  Migración de proyectos legacy (fx1-fx4 → zone-X)
   │  TEST: Visual regression, drag-drop, project load/save
   │
   ▼
WAVE 2543.4 — ZoneMapper centralizado
   │  Riesgo: BAJO | Impacto: ALTO | LOC: ~150
   │  Nuevo módulo src/core/zones/ZoneMapper.ts
   │  Refactor: Arbiter, Titan, TimelineEngine delegan al mapper
   │  TEST: Unit tests del mapper + integration con playback
   │
   ▼
WAVE 2543.5 — Verification & Cleanup
      Eliminar duplicación de lógica zone en Arbiter/Titan/TimelineEngine
      Audit final de coherencia
      Performance test: resolve() con 100+ fixtures
```

---

## ═══════════════════════════════════════════════════════════════════════
## PARTE V: RESUMEN EJECUTIVO
## ═══════════════════════════════════════════════════════════════════════

### El Warning Explicado

```
⚠️ Zone mapping not implemented for zones: all-pars — falling back to wildcard '*'
```

**Causa raíz:** `TimelineEngine.resolveFixtureIds()` tiene un `console.warn` donde debería tener una llamada a `masterArbiter.getFixtureIdsByZone()`. La función existe desde WAVE 2067, está probada y funciona. Solo falta conectarla. Es un TODO que quedó como placeholder y nunca se completó.

### El Quiebre de Diseño

Los tracks de Chronos fueron diseñados como **buses de mezcla** (GLOBAL/MOVEMENT/AMBIENT/ACCENT = priority layers). Para el modelo "Infinite Diamond" / GrandMA3-style necesitamos que sean **destinos físicos** (FRONT PARS / MOVERS L / AIR = zonas del stage). Son conceptos ortogonales que actualmente están conflados.

### La Buena Noticia

- Los datos de zona viajan intactos por todo el pipeline (Hephaestus → Chronos → Hyperion)
- El resolver de zonas ya existe y funciona (`MasterArbiter.getFixtureIdsByZone`)
- El matching de zonas ya existe y funciona (`TitanOrchestrator.fixtureMatchesZone`)
- Las zonas canónicas ya están definidas y migradas (WAVE 2040.26, 42 efectos)
- La Fase 1 (hotfix) se puede ejecutar ahora mismo con ~20 líneas de cambio

---

*Documento generado: 2026-04-10*  
*PunkOpus — Auditoría Estructural para WAVE 2543 "Infinite Diamond"*
