Voy a realizar una auditoría forense de solo lectura. Empezaré localizando los archivos clave del "crimen".

Tengo localizados los archivos clave. Voy a leerlos en paralelo para construir la "escena del crimen".

Necesito ver el resto del flujo: la parte final del TacticalCanvas (cleanup y data pump), el resto del worker (INIT handler), el resto del launcher, y cómo el tier seleccionado viaja hasta TacticalCanvas.

Ahora necesito ver cómo el tier viaja desde el launcher hasta el renderer, y cómo HyperionView decide entre TacticalCanvas y EcoTacticalStage. También verifico la config de workers en Vite.

Necesito ver cómo el tier del launcher llega a `isCanvasWorkerDisabled` (performanceStore) y cómo main.ts carga el renderer (file:// vs http). También confirmar la config de workers en Vite (no hay `worker.format`).

Necesito confirmar el estado inicial del store (tier por defecto antes de hidratar) y el hook de hidratación, para determinar la race condition.

Tengo el cuadro casi completo. Última verificación: comparar el patrón de instanciación de este worker con cualquier otro worker del renderer que sí funcione en PROD, y confirmar la divergencia documentación vs implementación.

Tengo toda la evidencia. Aquí está el reporte forense.

---

# 🩸 REPORTE FORENSE: Auditoría de Ciclo de Vida y Bundling de Workers (READ-ONLY)

## Resumen Ejecutivo

El "abismo" entre DEV y PROD tiene **dos vectores convergentes**, ambos irrefutables:

1. **Vector de Bundling (primario):** El worker se instancia con el patrón `new Worker(new URL(..., import.meta.url), {type:'module'})`, que Vite empaqueta como un **chunk ESM separado**. Bajo `file://` (PROD), Chromium/Electron **no puede cargar módulos ESM de workers desde el sistema de archivos** → el worker nunca arranca → `READY` nunca llega → stuck en "INITIALIZING...". En DEV (`http://localhost:5173`) el dev server sirve el módulo con CORS/MIME correctos → funciona.
2. **Vector de Race Condition del Launcher (secundario, agrava el primario):** `MainLayout` se monta tras `licenseReady` pero **NO** tras `isHydrated` del performance store. El store arranca por defecto en `'hq'` (`isCanvasWorkerDisabled = false`). Si el tier persistido es `'eco'`, `TacticalCanvas` se monta primero como HQ (ejecutando `transferControlToOffscreen()` + creación de worker), y **después** la hidratación async lo flippea a eco → desmontaje → teardown diferido → workers huérfanos / canvas transferido a un nodo que se destruye.

---

## VECTOR 1 — El Factor Bundling (Vite vs Electron file://)

### La escena del crimen

**Instanciación del worker** — `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\views\tactical\TacticalCanvas.tsx:101-112`:

```ts
function createRenderWorker(): Worker {
  const w = new Worker(
    new URL('../../../../workers/hyperion-render.worker.ts', import.meta.url),
    { type: 'module', name: 'hyperion-render' }
  )
```

Este es el patrón **"native URL Worker"** de Vite. En build, Vite detecta `new Worker(new URL('...', import.meta.url), {type:'module'})` y **emite un archivo `.js` separado** en `dist/assets/` conteniendo el worker compilado como **módulo ES** (con `import`/`export` estáticos).

### Por qué DEV lo permite y PROD lo asesina

**Carga del renderer** — `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\electron\main.ts:596-600`:

```ts
if (isDev) {
  mainWindow.loadURL('http://localhost:5173')
} else {
  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
}
```

| | DEV | PROD |
|---|---|---|
| Protocolo | `http://localhost:5173` | `file://` |
| `import.meta.url` resuelve a | `http://localhost:5173/src/workers/hyperion-render.worker.ts` | `file:///.../dist/assets/hyperion-render-[hash].js` |
| Fetch del worker | HTTP, MIME `text/javascript`, CORS OK | `file://` → **origen opaco** |
| Carga de ESM en worker | ✅ Chromium permite ESM sobre HTTP | ❌ Chromium **rechaza módulos ESM en workers desde `file://`** |

**Mecanismo de la muerte:** Los Web Workers con `{type:'module'}` requieren que el script del worker se sirva con un **MIME type JavaScript válido** y, para imports estáticos, que las URLs relativas sean resolubles bajo el mismo origen. Bajo `file://`:

1. `file://` URLs son tratadas como **origen opaco** (`null` origin) por Chromium.
2. El fetch del worker module desde `file://` no produce los headers CORS/MIME que el cargador de módulos exige.
3. Los `import` estáticos dentro del worker bundle (Vite los genera para code-splitting) **no pueden resolverse** contra `file://` sin un protocolo custom.
4. Resultado: el worker se crea pero **su script top-level nunca ejecuta** → `self.onmessage` nunca se registra → el `INIT` postado en `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\views\tactical\TacticalCanvas.tsx:442-452` cae en el vacío → `READY` nunca vuelve → `setIsReady(true)` nunca firea → UI stuck en "INITIALIZING...".

Adicionalmente, en builds empaquetados el `dist/` suele vivir dentro de `app.asar`, y el fetcher de `file://` de Chromium **no maneja rutas virtuales asar para módulos ESM de workers** de forma fiable — otro agravante PROD-only.

### La confesión escrita en el código

El bloque de comentarios `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\views\tactical\TacticalCanvas.tsx:76-81` es la **prueba de que esto ya se diagnosticó y se revertió**:

```
// WORKER INSTANTIATION — Vite ?worker suffix (OPERACIÓN LÁZARO, WAVE 2520)
// Using the ?worker import syntax instead of new URL() — Vite bundles the
// worker correctly for Electron's renderer process with this pattern.

// Use native URL Worker (emit separate worker file) — do not import via Vite ?worker inline.
```

Las líneas 76-78 **documentan la solución conocida** (`?worker` suffix → Vite inlinea el worker como Blob/base64, evitando el fetch `file://`). La línea 81 **revoca explícitamente** esa solución ("do not import via Vite ?worker inline") y la implementación (líneas 103-106) usa el patrón native URL que rompe bajo `file://`. **El fix que resolvía el problema fue desactivado a propósito.**

### Configuración de Vite: ausencias cargadas

`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\vite.config.ts`

- **No existe clave `worker:`** (sin `worker.format`, sin `worker.plugins`). El formato del worker queda como ESM por defecto (por `{type:'module'}`).
- **No existe `base:`** — no hay reescritura de URLs para un protocolo custom.
- **No hay `build.target`** que pudiera forzar formato iife para workers.
- Los workers `senses.ts`, `mind.ts`, `openDmxWorker.ts`, `GodEarFFT.ts`, `phantomPipeline.ts` (líneas 46-140) se bundlean **explícitamente como CJS** (`formats: ['cjs']`) porque son `worker_threads` de Node, no Web Workers del renderer. **Hyperion no recibe ese tratamiento** — es el único Web Worker del renderer y queda como ESM suelto.

### Evidencia correlativa: otros workers del renderer comparten el mismo patrón

- `ThetaOrchestrator.ts:705` usa el patrón idéntico `new Worker(new URL('./theta.worker.ts', import.meta.url), {type:'module'})`.
- `GodEarOffline.ts:120-123` ídem (su comentario línea 119 dice "create inline Blob worker" pero **la implementación también usa native URL** — el comentario miente).

Todos los Web Workers ESM del renderer comparten la misma vulnerabilidad `file://`. Hyperion es el más visible porque está en el **camino crítico de boot** (se monta al arrancar la app), mientras Theta/GodEar son bajo demanda.

---

## VECTOR 2 — El Factor Launcher (Race Condition de Montaje)

### Flujo de estado: launcher.html → TacticalCanvas

1. **Launcher** (`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\electron\launcher\launcher.html`): el operador elige tier (eco/balanced/hq) → `window.vanguard.commit({tier, skipLauncher})` (línea 541).
2. **Main process** (`launcherIpc.ts:177-221`): `launcher:commit` valida, persiste el tier en `ConfigManagerV2`, cierra el launcher. El boot continúa al cerrarse la ventana.
3. **Renderer arranca** → `AppContent` (`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\AppCommander.tsx:35-50`): ejecuta `usePerformanceHydration()` (async, IPC `launcher:getProfile`).
4. **`MainLayout` se monta** gated por `licenseReady` (`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\AppCommander.tsx:161-167`) — **NO** gated por `isHydrated` del performance store.
5. `HyperionView` lee `isCanvasWorkerDisabled` (`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\views\HyperionView.tsx:127-128`) y decide montar `TacticalCanvas` vs `EcoTacticalStage` (`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\views\HyperionView.tsx:364-401`).

### El estado por defecto miente

`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\stores\performanceStore.ts:70-78`:

```ts
export const usePerformanceStore = create<PerformanceState>((set) => ({
  ...deriveFlags('hq'),   // ← arranca como HQ
  hardware: null,
  isHydrated: false,      // ← no hidratado
```

`deriveFlags('hq')` → `isCanvasWorkerDisabled = false` (línea 66). **Antes de que la IPC `launcher:getProfile` resuelva, el store afirma "HQ" aunque el operador haya elegido ECO.**

### La carrera

- `usePerformanceHydration` (`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hooks\usePerformanceHydration.ts:41-56`) dispara la IPC **dentro de un `useEffect`** (async). Resuelve en un microtask posterior al primer paint.
- `licenseReady` se setea en `useLicenseStore.getState().hydrate().finally(...)` (`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\AppCommander.tsx:88-90`) — **otra IPC async independiente**.
- **No hay sincronización entre ambas hidrataciones.** Si `licenseReady` resuelve antes que `getPerformanceProfile`, `MainLayout` → `HyperionView` se monta con `isCanvasWorkerDisabled = false` (HQ por defecto).

### Consecuencia para modo ECO

Si el tier persistido es `eco`:

1. Primer render: `isCanvasWorkerDisabled = false` → `HyperionView` monta `<TacticalCanvas>`.
2. `TacticalCanvas` init effect (`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\views\tactical\TacticalCanvas.tsx:300-452`) ejecuta:
   - `canvas.transferControlToOffscreen()` (línea 340) — **irreversible**.
   - `createRenderWorker()` (línea 349) — crea el worker (que en PROD file:// ya está roto del Vector 1).
   - `worker.postMessage(INIT, [offscreen])` (línea 452).
3. Microtask después: `getPerformanceProfile` resuelve → `hydrate({tier:'eco'})` → `isCanvasWorkerDisabled` flip a `true`.
4. `HyperionView` re-renderiza → **desmonta `<TacticalCanvas>`** → monta `<EcoTacticalStage>`.
5. El cleanup de `TacticalCanvas` (`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\views\tactical\TacticalCanvas.tsx:480-499`) programa `setTimeout(0)` → `worker.terminate()`.

**Esto genera:**
- Un **worker huérfano efímero** que en PROD ya está roto (Vector 1) y además se termina inmediatamente.
- Un `<canvas>` cuyo `transferControlToOffscreen()` ya consumió el nodo — el nodo se destruye al desmontar, pero el OffscreenCanvas transferido quedó referenciado por un worker que nunca respondió. En hardware marginal con compositor software, esta secuencia **transfer→fallo→teardown** es exactamente el patrón que dispara **GPU process crash / Context Lost** en Chromium.
- El `isHydrated` existe como flag (línea 45) y el blueprint (líneas 18-21 de `usePerformanceHydration.ts`) dice "gate Eco swaps on `selectIsHydrated`" — **pero `HyperionView` NO lo usa como gate**. La protección fue diseñada y nunca se cableó.

### ¿Múltiples instancias huérfanas?

El "Immortal Guard" (`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\views\tactical\TacticalCanvas.tsx:315-319`) previene doble-transfer **dentro del mismo nodo DOM en Strict Mode**. Pero **no previene** el escenario HQ→ECO: el desmontaje destruye el nodo, el montaje de Eco crea un nodo distinto. No hay doble worker en sentido estricto, pero sí **un worker creado-destruido en un tick** que en PROD nunca llegó a inicializarse — el "INITIALIZING..." perpetuo puede ser del primer mount HQ antes del flip, si el flip llega tarde o la hidratación de performance falla (líneas 52-54 de `usePerformanceHydration.ts`: en fallo, **se queda en HQ para siempre**).

---

## VECTOR 3 — Divergencia de Entornos (Punto Exacto de Fricción)

El punto único de fricción arquitectónica es **la línea 599 de `main.ts`**:

```ts
mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
```

`loadFile` → protocolo `file://`. **Todo el resto del abismo se deriva de esta única línea** combinada con:

- `TacticalCanvas.tsx:103-106` — patrón native URL ESM worker.
- `vite.config.ts` — sin `worker.format`, sin `base`, sin protocolo custom.
- `AppCommander.tsx:165` — gate de `licenseReady` pero no de `isHydrated`.
- `performanceStore.ts:71` — default `'hq'`.

En DEV, `loadURL('http://localhost:5173')` (línea 597) cambia el protocolo a HTTP, el dev server sirve módulos con CORS/MIME, y la carrera HQ→ECO es inofensiva porque el worker ESM sí carga (aunque se termine al flip, el Eco DOM toma el relevo sin crash visible).

---

## Conclusión Forense

| Vector | Causa raíz | Línea culpable | Síntoma PROD |
|---|---|---|---|
| **Bundling** | Web Worker ESM cargado desde `file://` no ejecuta | `TacticalCanvas.tsx:103-106` + `main.ts:599` + `vite.config.ts` (sin `worker.format`/`base`) | Stuck "INITIALIZING..." / GPU Crash |
| **Launcher Race** | `MainLayout` monta sin esperar hidratación de performance tier; default HQ miente | `AppCommander.tsx:165` (falta gate `isHydrated`) + `performanceStore.ts:71` (default `'hq'`) | Worker huérfano + OffscreenCanvas transferido a nodo que se destruye → Context Lost |
| **Divergencia** | `loadFile` (file://) vs `loadURL` (http) | `main.ts:599` vs `main.ts:597` | Abismo DEV/PROD |

**El Vector 1 es necesario y suficiente** para explicar el fallo PROD. El Vector 2 es **suficiente por sí solo** para explicar inestabilidad en modo ECO y agrava el Vector 1 (crea y destruye un worker roto en el tick de boot, maximizando la ventana de GPU crash). La "escena del crimen" converge en: **un worker ESM que no puede cargarse bajo `file://`, instanciado antes de saber siquiera si debería existir.**

No se aplicaron fixes. Reporte de solo lectura completado.