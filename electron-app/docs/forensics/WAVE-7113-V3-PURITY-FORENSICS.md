# WAVE 7113: V3 PURITY FORENSICS

**Date:** 2026-07-01
**Severity:** CRITICAL — Architectural debt blocking demo readiness
**Scope:** FASE 2 (Demolición V2) & FASE 3 (Adaptar Consumidores) del PLAN-NUCLEO-LUX-V3
**Verdict:** FASE 2 completada en `types.ts` (tipos eliminados). FASE 3 **NUNCA se ejecutó**. La aplicación runtime opera con un modelo híbrido V1/V2/V3 que viola el principio de单一 fuente de verdad.

---

## 1. EL ESTADO DEL STORE — La Infección V1/V2

### 1.1 — Arquitectura Actual: Tres Stores Coexistentes

El plan maestro (FASE 3, sección 3A) exigía: `ChronosStoreV3` como **único** gestor de estado. La realidad es que existen **dos stores vivos** en runtime:

| Store | Clase | Tipo Interno | Rol Actual | Estado V3 |
|-------|-------|-------------|------------|-----------|
| **ChronosStore (V1)** | `ChronosStore` | `ChronosProjectV3` | Save/load IPC, auto-save, session sync | ✅ Usa V3 internamente |
| **ChronosStoreV2** | `ChronosStoreV2` | `ChronosProjectV3` (alias como V2) | CRUD de tracks, eventos UI | ⚠️ Tipos aliasados |
| **ChronosStoreV3** | — | — | **NO EXISTE** | ❌ Nunca se creó |

**Localización:** `src/chronos/core/ChronosStore.ts`

### 1.2 — ¿Por qué existen referencias a tracks V1 y stores V2?

**Respuesta corta:** FASE 2 demolió los **tipos** en `types.ts`, pero FASE 3 **nunca** unificó los stores. El resultado es un parche: `ChronosStoreV2` importa tipos V3 con **aliases V2** para no romper compilación.

**Evidencia — Aliases V2→V3** (`ChronosStore.ts:957-966`):

```typescript
import type {
  ChronosProjectV3 as ChronosProjectV2,   // ← Alias: tipo V3 con nombre V2
  LuxTrackV3 as TimelineTrackV2,           // ← Alias: tipo V3 con nombre V2
  LuxTrackUpdateV3 as TrackUpdateV2,       // ← Alias: tipo V3 con nombre V2
  LuxTargetZone,
} from './LuxFileV3'
import {
  createEmptyChronosProjectV3 as createDefaultProjectV2,  // ← Alias
  createTrackV3 as createTrackV2,                          // ← Alias
} from './LuxFileV3.factories'
```

**Evidencia — Comentario explícito de deuda técnica** (`ChronosStore.ts:8-9`):

```
WAVE 7100 FASE 2: V2 demolished. V3 core imported from LuxFileV3.
ChronosStoreV2 class body will have type errors — fix in FASE 3.
```

**Evidencia — Cast forzado inseguro** (`ChronosStore.ts:1094`):

```typescript
this.project = toChronosProjectV3(file) as unknown as ChronosProjectV2
```

### 1.3 — ¿Se instanció `ChronosStoreV3`?

**No.** `grep -r "ChronosStoreV3" src/` retorna **0 resultados**. El plan maestro (FASE 3, sección 3A) especificaba:

> `ChronosStoreV3` (reemplaza ChronosStoreV2):
> - `_applyLoadedJson()` → `deserializeLuxV3()`
> - `save()` → `serializeLuxV3()`
> - Estado interno = `ChronosProjectV3`

Esto **nunca se implementó**. En su lugar, `ChronosStore` (V1) fue migrado para usar V3 internamente, y `ChronosStoreV2` fue parchado con aliases.

### 1.4 — Dualidad de Stores en Runtime

La UI consume **ambos stores simultáneamente**:

**`ChronosStore` (V1)** — Usado por:
- `useChronosProject` hook (save/load/new project)
- `TransportBar` (auto-save indicator)
- `ChronosLayout` (event subscription: `project-loaded`, `project-new`)

**`ChronosStoreV2`** — Usado por:
- `ChronosLayout` (sync de tracks en load, routing de clips grabados)
- `TimelineCanvas` (render de tracks, subscription a eventos de track)
- `TrackLabelsOverlay` (CRUD de tracks: rename, toggle, solo, lock)

**Problema central:** Cuando se carga un proyecto, `ChronosLayout.handleProjectLoaded` debe **sincronizar manualmente** ambos stores:

```typescript
// ChronosLayout.tsx:741-745
const storeV2 = getChronosStoreV2()
storeV2.loadProject({
  ...data.project,
  tracks: data.project.tracks.map(t => ({ ...t, clips: [...t.clips] })),
} as any)
```

Esta sincronización manual es la **causa raíz** de bugs anteriores (clips flattening, tracks perdidas en load).

---

## 2. TIPOS Y SCHEMAS SUPERVIVIENTES — Violación de FASE 2

### 2.1 — Estado de FASE 2: Tipos V2 Eliminados ✅

`types.ts` confirma la demolición de tipos V2:

```
// WAVE 7100 FASE 2: V2 PROJECT TYPES DEMOLISHED
// ChronosProjectV2, TimelineTrackV2, TrackUpdateV2, ChronosProjectMeta,
// createDefaultProjectV2, createTrackV2, generateTrackV2Label — ALL REMOVED.
```

**Verificación:** `grep -r "LuxProject\b" src/` → **0 resultados**. `LuxProject` fue eliminado.

### 2.2 — Aliases V2 Sobrevivientes — Violación de FASE 2

Aunque los **tipos V2 originales** fueron eliminados, `ChronosStore.ts` **re-importa tipos V3 con nombres V2**:

| Alias V2 | Tipo V3 Real | Línea |
|----------|-------------|-------|
| `ChronosProjectV2` | `ChronosProjectV3` | 958 |
| `TimelineTrackV2` | `LuxTrackV3` | 959 |
| `TrackUpdateV2` | `LuxTrackUpdateV3` | 960 |
| `createDefaultProjectV2` | `createEmptyChronosProjectV3` | 964 |
| `createTrackV2` | `createTrackV3` | 965 |

**Impacto:** El código fuente contiene 6 referencias a `ChronosProjectV2` y 2 a `createDefaultProjectV2` que son **ilusiones** — apuntan a tipos V3 pero con nombres V2. Esto genera confusión arquitectónica y viola el principio "Sin Legacy, Sin Conversores" del plan maestro.

### 2.3 — Funciones Puente No Deseadas

**`ChronosStoreV2.loadFromJson()`** (`ChronosStore.ts:1087-1097`):

```typescript
// WAVE 7100 FASE 2: V2 detectProjectVersion demolished.
// V3 path: deserializeLuxV3 with $schema hard-gate + checksum verification.
// TODO FASE 3: Convert this to async and use deserializeLuxV3 properly.
const $schema = (raw as any)?.$schema
if ($schema === 'luxsync.lux/3.0') {
  const file = raw as LuxFileV3
  this.project = toChronosProjectV3(file) as unknown as ChronosProjectV2
  // ...
}
```

**Problemas:**
1. **TODO FASE 3 explícito** — el código admite que no está terminado
2. **Cast `as unknown as`** — bypass de type safety
3. **No usa `deserializeLuxV3`** — parsea JSON manualmente sin validación ni checksum
4. **Es una función puente** — traduce un JSON raw a `ChronosProjectV3` sin el pipeline V3

### 2.4 — Referencias V2 en Comentarios y Documentación

**`ZoneMapper.ts:29`:**
```
ChronosProject.luxToChronosV2()     (track assignment)
```
Comentario referencia a función `luxToChronosV2()` que **ya no existe**. No es un bug funcional, pero indica que la limpieza FASE 2 fue parcial.

**`ChronosProject.test.ts:6`:**
```
All V2 tests (PROJECT_VERSION, createProjectFromState, serializeProject sync,
validateProject with timeline.clips, etc.) have been demolished.
```
Test file es un stub — documenta la demolición pero no prueba nada V3.

### 2.5 — ChronosEngine: Nomenclatura V2 Persistente

**`ChronosEngine.ts`** usa `projectV2` como nombre de campo para un `ChronosProjectV3`:

```typescript
// ChronosEngine.ts:438
private projectV2: ChronosProjectV3 | null = null  // ← Tipo V3, nombre V2

// ChronosEngine.ts:487
public loadProjectV2(project: ChronosProjectV3): void {  // ← Tipo V3, nombre V2

// ChronosEngine.ts:818
public getProjectV2(): ChronosProjectV3 | null {  // ← Tipo V3, nombre V2
```

**11 referencias** a `projectV2` en `ChronosEngine.ts`, todas operando sobre `ChronosProjectV3`. La nomenclatura es engañosa.

---

## 3. EL MAPA DE EXTIRPACIÓN

### 3.1 — Componentes que necesitan refactorización

#### Stores (Prioridad CRÍTICA)

| Componente | Archivo | Cambio Requerido |
|-----------|---------|-----------------|
| **ChronosStore (V1)** | `ChronosStore.ts:131-676` | Renombrar a `ChronosStoreV3` o fusionar con V2. Eliminar dualidad. |
| **ChronosStoreV2** | `ChronosStore.ts:979-1180` | **Fusionar** con V1. Eliminar aliases V2. Usar `deserializeLuxV3` en `loadFromJson`. |
| **`getChronosStore()`** | `ChronosStore.ts:680` | Singleton del store unificado. |
| **`getChronosStoreV2()`** | `ChronosStore.ts:1370` | **Eliminar**. Reemplazar todas las referencias con `getChronosStore()`. |

#### Hooks (Prioridad ALTA)

| Componente | Archivo | Cambio Requerido |
|-----------|---------|-----------------|
| **`useChronosProject`** | `hooks/useChronosProject.ts` | Ya usa `getChronosStore()`. Verificar que usa V3 API. |
| **`useTimelineClips`** | `hooks/useTimelineClips.ts` | Evaluar si `clipState` (flat array) debe migrar a tracks-based o si el store unificado maneja la distribución. |

#### UI Components (Prioridad ALTA)

| Componente | Archivo | Referencias V2 | Cambio Requerido |
|-----------|---------|---------------|-----------------|
| **`ChronosLayout`** | `ui/ChronosLayout.tsx` | 7 calls a `getChronosStoreV2()` | Reemplazar con `getChronosStore()`. Eliminar sync manual entre stores. |
| **`TimelineCanvas`** | `ui/timeline/TimelineCanvas.tsx` | 5 calls a `getChronosStoreV2()` | Reemplazar con `getChronosStore()`. Subscribe a eventos del store unificado. |
| **`TrackLabelsOverlay`** | `ui/timeline/TrackLabelsOverlay.tsx` | 2 calls a `getChronosStoreV2()` | Reemplazar con `getChronosStore()`. |
| **`TransportBar`** | `ui/transport/TransportBar.tsx` | 2 calls a `getChronosStore()` | Ya usa V1. Verificar que no necesita V2. |

#### Engine (Prioridad MEDIA)

| Componente | Archivo | Cambio Requerido |
|-----------|---------|-----------------|
| **`ChronosEngine`** | `core/ChronosEngine.ts` | 11 refs a `projectV2` | Renombrar a `project` (sin sufijo V2). Renombrar `loadProjectV2` → `loadProject`. |

#### Core Types (Prioridad BAJA — Limpieza)

| Componente | Archivo | Cambio Requerido |
|-----------|---------|-----------------|
| **Aliases V2** | `ChronosStore.ts:957-966` | Eliminar aliases. Usar nombres V3 directamente. |
| **Comentarios V2** | `ZoneMapper.ts:29`, `types.ts:557-571` | Limpiar referencias a funciones V2 demolished. |

### 3.2 — Estrategia de Unificación

#### Fase A: Fusionar Stores (Sin romper UI)

**Objetivo:** Un solo store con la API combinada de V1 + V2.

```
PASO 1: ChronosStore (V1) absorbe la API de ChronosStoreV2
  - addTrack(), removeTrack(), reorderTrack(), renameTrack()
  - updateTrack(), toggleEnabled(), toggleSolo(), toggleLocked()
  - Eventos: track-added, track-removed, track-reordered, etc.
  - Campos: tracks[] gestionados directamente en this.project.tracks

PASO 2: getChronosStoreV2() → devuelve getChronosStore() (mismo singleton)
  - Función de compatibilidad temporal
  - Permite migrar componentes uno a uno sin romper compilación

PASO 3: Migrar consumidores UI
  - TimelineCanvas: getChronosStoreV2() → getChronosStore()
  - TrackLabelsOverlay: getChronosStoreV2() → getChronosStore()
  - ChronosLayout: eliminar sync manual entre stores

PASO 4: Eliminar getChronosStoreV2() y ChronosStoreV2 class
  - Eliminar aliases V2
  - Eliminar class ChronosStoreV2
  - Eliminar getChronosStoreV2()
```

#### Fase B: Limpiar Nomenclatura V2

```
PASO 5: ChronosEngine
  - projectV2 → project
  - loadProjectV2() → loadProject()
  - getProjectV2() → getProject()
  - generateContextV2() → generateContext()

PASO 6: Limpiar comentarios V2 en ZoneMapper, types.ts, tests
```

#### Fase C: Fix loadFromJson (Usar deserializeLuxV3)

```
PASO 7: ChronosStoreV2.loadFromJson() → usar deserializeLuxV3()
  - Eliminar parseo manual de JSON
  - Eliminar cast `as unknown as`
  - Usar validación + checksum del pipeline V3
```

### 3.3 — Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Sync manual eliminada → clips perdidos | Alto | Store unificado maneja tracks directamente. No hay dos copias. |
| Eventos V2 no encontrados por UI | Medio | Store unificado emite ambos sets de eventos (project-* y track-*). |
| `loadFromJson` async → breaking change | Bajo | Solo se usa en `ChronosStoreV2` que se elimina. |
| ChronosEngine rename → breaking | Bajo | `loadProjectV2` es llamado desde `ChronosLayout`. Actualizar callsite. |

### 3.4 — Estimación de Esfuerzo

| Fase | Archivos | Líneas cambiadas (est.) | Riesgo |
|------|----------|------------------------|--------|
| A: Fusionar Stores | 6 | ~200 | ALTO |
| B: Limpiar Nomenclatura | 3 | ~50 | BAJO |
| C: Fix loadFromJson | 1 | ~30 | MEDIO |
| **Total** | **10** | **~280** | |

---

## 4. RESUMEN EJECUTIVO

### Estado de las Fases del Plan Maestro

| Fase | Plan | Estado Real | Veredicto |
|------|------|------------|-----------|
| **FASE 1** | Schema V3 (núcleo inmutable) | ✅ Completada | Aprobado |
| **FASE 2** | Demolición V2 (tipos) | ⚠️ Parcial | Tipos eliminados en `types.ts`, pero **aliases V2** persisten en `ChronosStore.ts` |
| **FASE 3** | Adaptar Consumidores | ❌ No ejecutada | `ChronosStoreV3` no existe. Dos stores coexistentes. Sync manual. Engine usa nomenclatura V2. |
| **FASE 4** | Audio portable + análisis | ⚠️ Parcial | `relativePath` implementado pero frágil |
| **FASE 5** | VibeBase (whisper) | ⚠️ Parcial | Schema definido, no integrado en runtime |
| **FASE 6** | Record Mode V3 | ⚠️ Parcial | Funciona pero depende del modelo híbrido |

### Deuda Técnica Crítica para Demo

1. **Dualidad de stores** — Causa raíz de bugs de load (clips flattening, tracks perdidas)
2. **Sync manual** — `ChronosLayout` copia datos entre V1 y V2 en cada load. Frágil.
3. **`loadFromJson` sin validación** — No usa `deserializeLuxV3`. Cast inseguro.
4. **Nomenclatura V2 en Engine** — 11 referencias engañosas

### Recomendación

Ejecutar **Fase A (Fusionar Stores)** antes de la demo. Es el cambio de mayor impacto y resuelve la causa raíz de los bugs de load que han consumido sesiones recientes. Las fases B y C pueden postergarse.

---

## 5. APÉNDICE — Referencias Exactas

### Archivos con Violaciones V2 Vivas

| Archivo | Líneas | Violación |
|---------|--------|-----------|
| `src/chronos/core/ChronosStore.ts` | 957-966 | Aliases V2→V3 |
| `src/chronos/core/ChronosStore.ts` | 970-1180 | `ChronosStoreV2` class (debería ser V3 o fusionarse) |
| `src/chronos/core/ChronosStore.ts` | 1087-1097 | `loadFromJson` sin `deserializeLuxV3`, cast inseguro |
| `src/chronos/core/ChronosEngine.ts` | 438, 487, 818, 1016, 1051 | `projectV2` (tipo V3 con nombre V2) |
| `src/chronos/ui/ChronosLayout.tsx` | 65, 741, 827, 868 | `getChronosStoreV2()` calls + sync manual |
| `src/chronos/ui/timeline/TimelineCanvas.tsx` | 37, 692, 768, 825, 1691 | `getChronosStoreV2()` calls |
| `src/chronos/ui/timeline/TrackLabelsOverlay.tsx` | 18, 45 | `getChronosStoreV2()` calls |
| `src/core/zones/ZoneMapper.ts` | 29 | Comentario referencia `luxToChronosV2()` (función eliminada) |
| `src/chronos/core/types.ts` | 557-571 | Comentarios de demolición (limpieza documental) |
| `src/chronos/__tests__/ChronosProject.test.ts` | 3-9 | Stub de tests V2 demolished |

### Grep Verification Commands

```bash
# Aliases V2 en código vivo
grep -rn "ChronosProjectV2" src/chronos/core/ChronosStore.ts
# Resultado: 6 matches (aliases, no tipos reales)

# ChronosStoreV3 (debería existir pero no existe)
grep -rn "ChronosStoreV3" src/
# Resultado: 0 matches

# getChronosStoreV2 (debería eliminarse)
grep -rn "getChronosStoreV2" src/
# Resultado: 21 matches en 6 archivos

# projectV2 (nomenclatura engañosa en Engine)
grep -rn "projectV2\b" src/chronos/core/ChronosEngine.ts
# Resultado: 11 matches

# luxToChronosV2 (función demolida referenciada en comentarios)
grep -rn "luxToChronosV2" src/
# Resultado: 1 match en ZoneMapper.ts (comentario)
```

---

> **Veredicto Final:** FASE 2 demolió los tipos. FASE 3 nunca se ejecutó.
> La aplicación funciona con un modelo híbrido donde dos stores
> mantienen copias paralelas del mismo `ChronosProjectV3` y se
> sincronizan manualmente en `ChronosLayout`. Esta arquitectura
> es la causa raíz de los bugs de load persistidos en sesiones recientes.
> **Fusionar los stores es la acción de mayor impacto pre-demo.**
