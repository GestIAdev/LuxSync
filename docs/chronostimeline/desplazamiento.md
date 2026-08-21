Entendido. Solo el panning horizontal, simple. Déjame ver cómo funciona el zoom/scroll actual:

Déjame leer el manejador de rueda completo y el sistema de estado del viewport:

¡Ya existe panning con Shift+wheel y trackpad deltaX! Está en las líneas 963-978. Déjame ver qué falta — el método C (middle-mouse drag). También déjame ver los manejadores de mouse existentes:

Ahora veo el panorama. Shift+wheel y trackpad deltaX ya funcionan. Falta el método C: middle-mouse drag. Déjame ver el manejador del clip drag start para entender cómo no interferir:

Ahora veo el SVG y su onMouseDown. Déjame ver el render del SVG principal:

Bien. Ahora tengo todo el contexto. El panning con Shift+wheel y trackpad deltaX ya existe. Solo falta el método C: middle-mouse drag. Voy a añadirlo de forma sencilla, sin interferir con el drag de clips existente.

Ahora añado el middle-mouse drag. Necesito: un ref para el estado de pan, un `onMouseDown` en el SVG que detecte `e.button === 1`, y un effect global para mousemove/mouseup cuando está paneando. Primero añado el estado:

Ahora añado el effect global para middle-mouse pan (mousemove/mouseup), justo después del effect de clip drag existente. Déjame leer el final del effect de clip drag:

Ahora añado el effect del middle-mouse pan justo después:

Ahora añado el `onMouseDown` en el SVG para detectar middle-click e iniciar el pan. También necesito prevenir el `onClick` (seek) cuando es middle-click. Déjame ver el SVG render:

Añado `onMouseDown` al SVG para detectar middle-click:

Ahora creo el `handleMouseDown` callback. Lo añado justo antes del `handleClick` existente:

Ahora añado un cursor de agarre (grab cursor) cuando se está desplazando. Déjame también verificar que el `handleClick` no se dispara después de un pan con el botón central. El `onClick` solo se dispara con el botón izquierdo, por lo que el botón central es seguro. Pero el `mouseup` del botón central puede generar un evento `auxclick`, no un `click`. Déjame verificar que no hay problema:

Bien. `onClick` solo se dispara con el botón izquierdo del ratón, por lo que el botón medio del ratón no lo activará. Ahora añado el cursor de agarre (grab cursor) en el CSS cuando se está desplazando. Déjame ver el CSS:

Añado un cursor de agarre (grab cursor) para el estado de desplazamiento (panning). Añado una clase CSS:

Ahora añado la clase `panning` al container cuando `isPanning` es true:

Ahora también necesito prevenir el `auxclick` / middle-click default del navegador (auto-scroll). Añado `onAuxClick` para prevenirlo:

Ahora verifico con tsc:

Limpio. Ahora los tests:

Listo. Resumen:

## WAVE 7565.4: Panning Horizontal — Complete

### Lo que ya existía
El timeline **ya tenía** panning horizontal con dos métodos:
- **Shift + Wheel** (línea 963-978 en `TimelineCanvas.tsx`)
- **Trackpad deltaX** nativo (mismo bloque)

### Lo que añadí: Método C — Middle-mouse drag

**1. Estado de pan** (línea ~700): <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\chronos\ui\timeline\TimelineCanvas.tsx" lines="700-701" />

```ts
const [isPanning, setIsPanning] = useState(false)
const panStartRef = useRef<{ x: number; startTime: number } | null>(null)
```

**2. `handleMouseDown`** (línea ~992): detecta `e.button === 1` (middle-click), guarda la posición inicial y activa el pan: <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\chronos\ui\timeline\TimelineCanvas.tsx" lines="992-1004" />

**3. Effect global de pan** (línea ~1294): escucha `mousemove`/`mouseup` en `document` cuando `isPanning` es true. Convierte el delta de píxeles a delta de tiempo usando `viewport.pixelsPerSecond` (invertido: drag derecha → vista izquierda): <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\chronos\ui\timeline\TimelineCanvas.tsx" lines="1294-1329" />

**4. `onAuxClick` preventDefault** en el SVG (línea ~1383): previene el auto-scroll nativo del navegador al middle-click.

**5. Cursor CSS** `grabbing` durante el pan: <ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\chronos\ui\timeline\TimelineCanvas.css" lines="62-69" />

### No interferencia con clip drag
- El pan usa `isPanning` + `panStartRef` (estado separado)
- El clip drag usa `draggingClipId` + `dragStartRef` (estado separado)
- Los dos effects son independientes — se activan solo cuando su estado respectivo está activo
- `onClick` (seek) solo se dispara con botón izquierdo, no con middle-click

### Verificación
| Check | Result |
|-------|--------|
| `tsc --noEmit` | exit 0 |
| 14 test files | 273/273 passed |