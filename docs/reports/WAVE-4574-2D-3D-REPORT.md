# WAVE 4574 - Reporte tecnico del Canvas 2D/3D

## 1) Objetivo de la intervencion

Corregir la inconsistencia funcional entre la vista 2D y la vista 3D del Stage Constructor, eliminando residuos de la arquitectura Guerrilla y definiendo una separacion canonica por dominio:

- 3D como dominio espacial real (IK): fixtures `isPlaced=true`.
- 2D como dominio pan-tilt clasico: fixtures `isPlaced=false`.

Adicionalmente:

- reparar drag & drop desde libreria al canvas 2D,
- reparar seleccion en 2D para abrir Properties,
- eliminar creacion fantasma por click en libreria,
- evitar reflejos cruzados entre vistas.

## 2) Ejecucion y diagnostico (timeline resumido)

### Fase A - Bug de drop libreria -> 2D

Sintoma:
- arrastrar desde libreria al canvas 2D no creaba fixture.

Causa raiz:
- `StageCanvas2D` leia `application/fixture-type`.
- La libreria emitia `fixture-type` y `library-fixture-id`.
- El Path B hacia bubble de un CustomEvent sin listeners.

Correccion:
- Path B de `StageCanvas2D` reescrito para crear fixture directo con:
  - `createDefaultFixture(...)`
  - `addFixture(...)`
  - `setFixtureZone(...)`
  - carga opcional de definicion via `window.lux.getFixtureDefinition(...)`.

Resultado:
- drop libreria -> 2D funcional y sin dependencia de 3D.

### Fase B - Reflejo 2D<->3D y residuos Guerrilla

Sintomas:
- drop en 2D aparecia tambien en 3D (reflejo).
- click en libreria creaba fixture fantasma en pipeline legacy.
- aviso de unplaced confuso por herencia antigua.

Causas raiz:
- 2D estaba setando `isPlaced=true`, por lo tanto 3D lo renderizaba.
- `FixtureLibrarySidebar` mantenia `handleQuickAdd` (click-to-add heredado de Guerrilla).

Correcciones:
- extirpado `handleQuickAdd`.
- removido `onSelect={handleQuickAdd}` en `UniversalAssetBrowser`.
- estandar de dominios:
  - `StageGrid3D`: render solo `fixtures.filter(f => f.isPlaced)`.
  - `StageCanvas2D`: render solo `fixtures.filter(f => !f.isPlaced)`.
- drops y drag interno del 2D mantienen `isPlaced=false`.

Resultado:
- no hay reflejo cruzado por defecto entre vistas.
- click en libreria ya no crea fixtures; solo D&D.

### Fase C - Seleccion 2D y panel de propiedades

Sintoma:
- click en fixture del canvas 2D no abria propiedades.

Causa:
- glyphs de SVG sin handler de seleccion.

Correccion:
- agregado `onClick` en glyph de fixture para seleccionar en `selectionStore`.
- agregado click en fondo SVG para `deselectAll()`.

Resultado:
- seleccion en 2D sincronizada con panel Properties.

### Fase D - Crash de contexto `useConstructorContext`

Sintoma:
- runtime crash: `useConstructorContext must be used within StageConstructorView`.

Causa raiz:
- ciclo de imports entre `StageConstructorView` y `StageGrid3D` por definicion/consumo del contexto en el mismo modulo.

Correccion estructural:
- contexto extraido a modulo dedicado:
  - `src/components/views/StageConstructor/StageConstructorContext.ts`
- `StageConstructorView` y `StageGrid3D` importan desde ese modulo.

Resultado:
- ciclo roto y contexto estable en runtime/HMR.

## 3) Diatriba 2D/3D y el flag isPlaced

El problema historico venia de tratar 2D y 3D como dos camaras de un mismo set de fixtures sin frontera semantica. Eso genero una mezcla peligrosa:

- acciones de 2D contaminaban 3D,
- acciones legacy de libreria entraban por caminos no canonicos,
- el usuario percibia "magia negra" y reflejos no intencionales.

### Regla doctrinal actual

`isPlaced` no es un detalle visual. Es una frontera de dominio:

- `isPlaced=true`:
  - fixture pertenece al espacio 3D real,
  - entra en logica IK/motor espacial,
  - visible/operable en StageGrid3D.

- `isPlaced=false`:
  - fixture pertenece al flujo pan-tilt clasico,
  - editable/operable en StageCanvas2D,
  - no debe invadir la escena 3D.

Esta separacion baja entropia, elimina ambiguedad y evita efectos emergentes absurdos.

## 4) Estructura final del Canvas 2D (post-fix)

### Entrada de fixtures al 2D

- D&D desde libreria:
  - lee `fixture-type` + `library-fixture-id`.
  - crea fixture con `isPlaced=false`.
  - asigna posicion X/Z y zona canonica.

- D&D desde chips unplaced (tray):
  - usa `application/fixture-id`.
  - actualiza posicion X/Z y mantiene `isPlaced=false`.

### Render y comportamiento

- SVG 2D renderiza fixtures `!isPlaced`.
- drag interno sobre SVG reposiciona fixture y mantiene `!isPlaced`.
- click en glyph selecciona fixture para Properties.
- click en fondo limpia seleccion.

### Tray unplaced

- conserva rol de rescate para fixtures legacy sin posicion real (sentinela/no posicion).
- al tener posicion valida en canvas, la fixture queda en SVG y no debe permanecer en tray.

## 5) Archivos clave impactados

- `electron-app/src/components/views/StageConstructor/StageCanvas2D.tsx`
- `electron-app/src/components/views/StageConstructor/StageGrid3D.tsx`
- `electron-app/src/components/views/StageConstructorView.tsx`
- `electron-app/src/components/views/StageConstructor/StageConstructorContext.ts`
- `electron-app/src/components/views/StageConstructorView.css`
- `electron-app/src/components/shared/AssetBrowser/AssetCard.tsx`
- `electron-app/src/components/hyperion/views/tactical/useFixtureData.ts`

## 6) Estado final

Arquitectura estabilizada con frontera 2D/3D explicita por `isPlaced`, pipeline de D&D canonico, seleccion 2D operativa y contexto desacoplado.

El sistema deja de depender de residuos Guerrilla y reduce el riesgo de regresiones por acople entre vistas.
