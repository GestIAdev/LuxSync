# ⌨ WAVE 4804 — KEYFORGE LOADOUTS: PHASE H PRE-FLIGHT FORENSIC REPORT

> **Auditor:** PunkOpus / FORENSIC_ENGINE  
> **Fecha:** 2026-05-19  
> **Rama:** `v3`  
> **Directiva:** Solo lectura. Cero modificaciones.  
> **Objetivo:** Trazar el plan arquitectónico para Loadout persistence (save / load / switch / export / import JSON).

---

## 1. ESTADO DEL STORE — Persistencia actual

### 1.1 Mecanismo activo

`keyMapStore.ts` usa **Zustand `persist` middleware** escribiendo en **`localStorage`** bajo la clave `'luxsync-keyforge'`.

```ts
// electron-app/src/stores/keyMapStore.ts (líneas ~406-418)
persist(
  (set, get) => ({ ... }),
  {
    name: 'luxsync-keyforge',
    version: 1,
    partialize: (state) => ({
      bindings: state.bindings,   // Record<`${layer}::${key}`, KeyBinding>
      chords:   state.chords,     // ChordBinding[]
    }),
  },
)
```

**Conclusiones críticas:**

| Aspecto | Realidad |
|---|---|
| **Motor** | `zustand/middleware/persist` |
| **Destino** | `window.localStorage` (renderer process) |
| **Clave** | `'luxsync-keyforge'` |
| **Schema version** | `1` |
| **Estado NO persistido** | `currentLayer`, `isLearning`, `isLearnModeActive`, `pendingMappingAction`, `listeningSlot`, `lastBoundKey`, `lastMappingWarning` |
| **Electron userData** | ❌ NO usa `app.getPath('userData')` ni archivos nativos |
| **IPC** | ❌ Cero invocaciones IPC para la persistencia actual del store |

**Riesgo actual:** El perfil activo vive en `localStorage` del renderer. Si el usuario borra el almacenamiento de Electron (DevTools → Application → Clear Storage) o reinstala la app, **pierde todos sus bindings**. La Fase H corrige exactamente esto.

---

### 1.2 Estructura exportable — `KeyForgeLoadout` (no existe aún)

No hay ninguna interfaz `KeyForgeLoadout` declarada en `keyforge/types.ts` ni en ningún otro archivo del proyecto. Los tipos actuales de `partialize` producen:

```ts
// Lo que el store persiste HOY (estructura implícita):
{
  bindings: Record<string /* `${layer}::${key}` */, KeyBinding>,
  chords:   ChordBinding[]
}
```

Para Phase H necesitamos un tipo explícito que añada metadatos de perfil:

```ts
// PROPUESTA — añadir a keyforge/types.ts en la implementación
export interface KeyForgeLoadout {
  readonly id:          string       // UUID v4 (crypto.randomUUID)
  readonly name:        string       // "Stadium Default", "Techno Mode"...
  readonly version:     1            // schema version, para migraciones futuras
  readonly createdAt:   string       // ISO 8601
  readonly updatedAt:   string       // ISO 8601
  readonly bindings:    Readonly<Record<string, KeyBinding>>
  readonly chords:      readonly ChordBinding[]
}
```

**Garantía de backward compatibility:** Los campos `bindings` y `chords` son literalmente los mismos que `partialize` ya serializa. Un JSON exportado desde Fase H puede cargarse de nuevo hidratando directamente el store con `set({ bindings, chords })`. El `localStorage` existente no se toca.

---

## 2. CAPACIDADES IPC / FILESYSTEM — ¿Qué existe y qué falta?

### 2.1 Inventario de IPC relevante (lo que YA existe)

#### `lux:stage:saveAsDialog` — plantilla de oro  
**Archivo:** `electron-app/src/core/stage/StageIPCHandlers.ts` (línea 224)

```ts
// Patrón EXACTO a clonar para KeyForge:
const result = await dialog.showSaveDialog(mainWindow!, {
  title: 'Save Stage Show As',
  defaultPath: path.join(showsPath, `${defaultName}.v2.luxshow`),
  filters: [{ name: 'LuxSync Shows', extensions: ['v2.luxshow'] }]
})
if (result.canceled || !result.filePath) return { success: false, cancelled: true }
fs.writeFileSync(filePath, JSON.stringify(showFile, null, 2), 'utf-8')
```

Este handler demuestra que el patrón `dialog.showSaveDialog` + `fs.writeFileSync` ya está validado y en producción en LuxSync. Es el **blueprint directo** para los handlers de KeyForge.

#### `lux:save-fixture-definition` — `fs.writeFileSync` en producción  
**Archivo:** `electron-app/src/core/orchestrator/IPCHandlers.ts` (línea 1021)  
Escribe un JSON serializado a una carpeta predeterminada. Segundo precedente.

#### `lux:stage:load` / `lux:stage:save`  
Cargan/guardan por `filePath`. El patrón de `showOpenDialog` equivalente está implícito en el sistema de stage.

### 2.2 Lo que NO existe (gaps para Phase H)

| Handler IPC | Estado | Propósito |
|---|---|---|
| `lux:keyforge:export` | ❌ No existe | Abrir `showSaveDialog` → serializar loadout → `fs.writeFileSync` como `.kf.json` |
| `lux:keyforge:import` | ❌ No existe | Abrir `showOpenDialog` → `fs.readFileSync` → devolver objeto JSON al renderer |

**Diagnóstico:** Necesitamos crear **exactamente 2 nuevos handlers IPC**, siguiendo el patrón ya establecido por `StageIPCHandlers.ts`. No hay nada genérico reutilizable para abrir un file picker arbitrario; en Electron, cada diálogo es específico a su handler.

### 2.3 preload.ts — exposición al renderer

Actualmente `preload.ts` no expone nada bajo un namespace `keyforge`. El bridge `window.lux` ya tiene decenas de namespaces (`stage`, `library`, `ingenio`, etc.). Se necesita añadir:

```ts
// Propuesta — a añadir en preload.ts bajo window.lux.keyforge:
keyforge: {
  exportLoadout: (loadout: KeyForgeLoadout) =>
    ipcRenderer.invoke('lux:keyforge:export', loadout),
  importLoadout: () =>
    ipcRenderer.invoke('lux:keyforge:import'),
}
```

Y los tipos correspondientes en `vite-env.d.ts`.

---

## 3. PUNTO DE INYECCIÓN EN LA UI

### 3.1 Arquitectura actual de `KeyForgeOverlay.tsx`

El componente principal renderiza dos columnas:

```
┌──────────────── 65% width ─────────────────┬──── 35% width (flex-1) ─────┐
│  HEADER (título + badges + botones)         │                             │
│  ─────────────────────────────────────────  │    ActionPalette            │
│  LAYER TABS (base/alt/cmd/select/...)       │    (search + action list)   │
│  ─────────────────────────────────────────  │                             │
│  KEYBOARD HOLOGRAM (KeyCell grid)           │                             │
│  ─────────────────────────────────────────  │                             │
│  FOOTER (manual de operador, texto)         │                             │
└─────────────────────────────────────────────┴─────────────────────────────┘
```

### 3.2 El header actual (línea ~622) — estructura del flex container

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: '10px', ... }}>
  {/* 1. Título: "⌨ KEYFORGE" */}
  <span>⌨ KEYFORGE</span>

  {/* 2. Layer badge (BASE / ALT / CMD...) */}
  <span>{layerMeta.label}</span>

  {/* 3. Bound count ("12 bound") */}
  <span>{boundCount} bound</span>

  {/* 4. SPACER — divide left info de right actions */}
  <div style={{ flex: 1 }} />

  {/* 5. LEARN button */}
  <button onClick={...}>○ LEARN</button>

  {/* 6. CLR LAYER button */}
  <button onClick={...}>CLR LAYER</button>
</div>
```

### 3.3 Punto de inyección óptimo

**Justo antes del spacer `<div style={{ flex: 1 }} />`** (o justo después, antes de los botones existentes), insertar un micro-toolbar de LOADOUTS:

```
[⌨ KEYFORGE] [BASE] [12 bound]  ←spacer→  [SAVE ▾] [LOAD ▾] [EXPORT] [IMPORT]  [● LEARN] [CLR LAYER]
```

O, más compacto, un único botón dropdown:

```
[⌨ KEYFORGE] [BASE] [12 bound]  ←spacer→  [⚙ LOADOUT ▾]  [● LEARN] [CLR LAYER]
```

**Razón:** El header es el único lugar con real estate horizontal. La columna derecha ya está ocupada por `ActionPalette`. El footer es texto inmutable. Los LAYER TABS tienen su propio propósito. El header es la única barra de comandos del componente.

**Implementación sugerida para la UI:** Un simple `<select>` nativo + botones inline es suficiente para MVP. No hace falta un dropdown custom elaborado — en una herramienta de operador, la funcionalidad prima sobre el ornamento.

---

## 4. PLAN DE ACCIÓN — 3 PASOS PARA PHASE H

### PASO 1 — Fundación de tipos + Store (todo en el renderer, sin IPC)

**Archivos tocados:** `keyforge/types.ts`, `stores/keyMapStore.ts`

1. Declarar `KeyForgeLoadout` en `types.ts` (la interfaz propuesta en §1.2).
2. Añadir al `KeyMapState` tres nuevas acciones:
   - `exportCurrentAsLoadout(name: string): KeyForgeLoadout` — snapshot inmutable del estado actual
   - `importLoadout(loadout: KeyForgeLoadout): void` — hidrata `bindings` y `chords`, respeta `version`
   - `resetToStadiumDefaults(): void` — alias de `clearAll()` + `initStadiumLoadoutIfEmpty()`
3. Añadir `loadoutName: string` al state persistido (nombre del perfil activo, por defecto `'stadium-default'`).

**Impacto en localStorage:** El campo `loadoutName` se añade a `partialize`. El `version` sube de `1` a `2`. Zustand migrate function trivial: `(state) => ({ ...state, loadoutName: 'stadium-default' })`.

---

### PASO 2 — IPC handlers (proceso Main) + Bridge (preload)

**Archivos tocados:** `StageIPCHandlers.ts` (o nuevo `KeyForgeIPCHandlers.ts`), `preload.ts`, `vite-env.d.ts`

1. Crear handler `lux:keyforge:export`:
   - Recibe `loadout: KeyForgeLoadout` desde renderer
   - Abre `dialog.showSaveDialog()` con filtro `['kf.json']`
   - `fs.writeFileSync(filePath, JSON.stringify(loadout, null, 2), 'utf-8')`
   - Retorna `{ success: boolean, filePath?: string }`

2. Crear handler `lux:keyforge:import`:
   - Abre `dialog.showOpenDialog()` con filtro `['kf.json']`
   - `fs.readFileSync(filePath, 'utf-8')` → `JSON.parse()`
   - Valida que el objeto tenga `version === 1` (o schema actual)
   - Retorna `{ success: boolean, loadout?: KeyForgeLoadout }`

3. Exponer en `preload.ts` bajo `window.lux.keyforge: { exportLoadout, importLoadout }`.
4. Tipado en `vite-env.d.ts`.

**Dónde registrar los handlers:** El patrón establecido en `StageIPCHandlers.ts` es el modelo. Se puede crear `electron-app/src/core/keyforge/KeyForgeIPCHandlers.ts` e importarlo en `main.ts` exactamente como ya hace `registerStageIPCHandlers`.

---

### PASO 3 — UI en KeyForgeOverlay.tsx

**Archivo tocado:** `KeyForgeOverlay.tsx` (solo el header — ±40 líneas nuevas)

1. Importar `useKeyMapStore` selectores de las nuevas acciones (§Paso 1).
2. Inyectar en el header, justo antes del spacer, un sub-bloque con 4 botones:

```tsx
{/* LOADOUT TOOLBAR — WAVE 4804 */}
<button onClick={handleSaveToFile}>SAVE</button>
<button onClick={handleLoadFromFile}>LOAD</button>
<button onClick={handleExportJSON}>EXPORT</button>
<button onClick={handleImportJSON}>IMPORT</button>
```

Donde:
- **SAVE** → `exportCurrentAsLoadout(name)` + `window.lux.keyforge.exportLoadout(loadout)` → diálogo nativo
- **LOAD** → `window.lux.keyforge.importLoadout()` → si success, `store.importLoadout(data.loadout)`
- **EXPORT** → igual que SAVE (alias semántico — mismo flujo, diferente label para claridad operacional)
- **IMPORT** → igual que LOAD

El nombre del loadout se puede tomar de un `<input>` inline (mini `prompt()` en la propia UI) o de un `window.prompt()` temporal si queremos evitar estado extra. La decisión está abierta.

---

## 5. SÍNTESIS — MAPA DE GAPS

| Gap | Severidad | Paso que lo cierra |
|---|---|---|
| No existe tipo `KeyForgeLoadout` | Bloquea todo | Paso 1 |
| Store no tiene `exportCurrentAsLoadout()` / `importLoadout()` | Bloquea todo | Paso 1 |
| No existen handlers IPC `lux:keyforge:export` / `import` | Necesario para archivos nativos | Paso 2 |
| `preload.ts` no expone `window.lux.keyforge` | Bloquea Paso 3 | Paso 2 |
| No hay UI de LOADOUTS en el overlay | Bloquea el operador | Paso 3 |
| `localStorage` como único medio de persistencia | Riesgo de pérdida de datos | Pasos 2+3 |

**Nada en el sistema actual colisiona con la implementación propuesta.** La persistencia `localStorage` existente no se elimina — sigue siendo la capa de "session state" activo. Los archivos `.kf.json` son la capa de "archivado portátil". Coexisten. El operador tiene el mejor de los dos mundos.

---

*Documento generado como hallazgo puro. Cero líneas de código modificadas.*
