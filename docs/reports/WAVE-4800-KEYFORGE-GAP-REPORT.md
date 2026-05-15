# WAVE 4800 KeyForge - Reporte de Brecha y Plan de Siguiente Lote

Fecha: 2026-05-15
Repositorio: LuxSync
Rama: v3
Autor: GitHub Copilot

## 1) Resumen ejecutivo

El teclado KeyForge quedo funcional en su nucleo operativo de Batch 3 (transporte de cues, toggles de UI y escalado visual del overlay), pero todavia no alcanza el nivel completo definido por el blueprint en las areas de Learn Mode, capa cmd, perfiles multi-show y guardrails de seguridad.

Estado global estimado por bloques del blueprint:
- Bloques operativos (captura + dispatch + layout base): implementados en nivel utilizable.
- Bloques de producto avanzado (aprendizaje visual + comandos MA3-like + perfiles + safety): pendientes.

## 2) Alcance comparado blueprint vs implementacion

## 2.1 Implementado

- Overlay de teclado escalado y ampliado:
  - Teclas mas grandes, panel mas ancho, tipografia mayor.
  - Fila de teclas de funcion y fila de flechas/paginacion visibles.
- Wiring de acciones cue-*:
  - cue-go/cue-next/cue-prev/cue-play/cue-pause conectadas a sceneStore.
- Wiring de acciones ui-*:
  - ui-toggle-forge/ui-toggle-zen/ui-toggle-3d conectadas a navigationStore.
- Loadout por defecto ampliado:
  - ArrowRight/PageDown -> cue-next
  - ArrowLeft/PageUp -> cue-prev
  - ArrowUp -> cue-play
  - ArrowDown -> cue-pause
  - F2/F3/F4 -> ui-toggle-*

## 2.2 Parcial

- Chords:
  - Hay base funcional por bindings de chord en loadout.
  - Falta editor/descubribilidad/validacion en interfaz.

## 2.3 Pendiente

- Learn Mode completo de KeyForge (UI de aprendizaje real):
  - Selector de layer interactivo.
  - Catalogo de acciones con busqueda.
  - Drag and drop de acciones a teclas.
  - Edicion visual de chords.
  - Heatmap de uso.
- Capa cmd (sintaxis tipo consola MA3):
  - Parser verbo-objeto-commit.
  - Barra de comando flotante.
  - Dispatch de comandos complejos.
- Perfiles multi-show:
  - Guardar/cargar/exportar/importar loadouts por nombre.
- Safety y anti-patterns:
  - Deteccion de conflictos de mapping.
  - Proteccion de teclas atascadas.
  - Undo/redo en Learn Mode.
  - Debounce y politicas anti-disparo accidental.

## 3) Evidencia tecnica por archivo

- Overlay y presentacion visual:
  - [electron-app/src/components/KeyForgeOverlay.tsx](electron-app/src/components/KeyForgeOverlay.tsx)
- Dispatcher de acciones:
  - [electron-app/src/keyforge/KeyActionDispatcher.ts](electron-app/src/keyforge/KeyActionDispatcher.ts)
- Loadout por defecto:
  - [electron-app/src/keyforge/stadiumLoadout.ts](electron-app/src/keyforge/stadiumLoadout.ts)
- Blueprint fuente:
  - [WAVE-4800-KEYFORGE-BLUEPRINT.md](WAVE-4800-KEYFORGE-BLUEPRINT.md)

## 4) Propuesta del siguiente lote de trabajo

Nombre sugerido: WAVE 4800 Batch 4 - Learn Mode y Hardening

Objetivo principal:
- Completar la experiencia de teclado como Command Wing configurable en vivo, con seguridad operativa.

### 4.1 Entregables obligatorios

1. Learn Mode v1 (end-to-end)
- Selector de layer activo (base, alt, cmd, select, kinetic, forge).
- Paleta de acciones filtrable por familia (fx, vibe, arb, sel, kin, ctrl, cue, ui, kf).
- Asignacion de accion a tecla desde UI.
- Persistencia en keyMapStore.

2. Chord Workbench v1
- Alta/edicion/baja de chords desde interfaz.
- Validacion de conflictos (tecla sola vs chord, chord vs chord).
- Vista de chords activos por layer.

3. Safety Pack v1
- Deteccion de key stuck con release forzado.
- Reglas de debounce para acciones sensibles (arb-blackout, arb-kill-effects).
- Historial de cambios (undo/redo) en edicion de mappings.

4. Cmd Layer Foundation
- Barra de comando visual.
- Parser minimo: Group, Fixture, Store, Delete + Enter para commit.
- Integracion al dispatcher unificado.

### 4.2 Entregables opcionales

- Heatmap visual de uso por tecla.
- Tooltips de ayuda contextual por accion.
- Export/import de perfiles como JSON.

## 5) Orden recomendado de implementacion (secuencia)

Fase A - Infra de edicion
- Modelo de datos para session de edicion.
- API de validacion de conflictos.
- Persistencia atomica de cambios.

Fase B - UI Learn Mode
- Panel de layers + listado de acciones + detalle de tecla.
- Flujos de asignacion y reasignacion.

Fase C - Chords + Safety
- Chord editor + motor de validacion.
- Debounce, anti-stuck y guardrails.

Fase D - Cmd Layer
- Command line flotante.
- Parser basico y commit sobre dispatcher.

## 6) Riesgos y mitigaciones

Riesgo 1: colisiones de mappings y regresiones de input.
- Mitigacion: validador central, tests de conflicto, rollback rapido.

Riesgo 2: latencia o comportamiento inconsistente en hot path de teclado.
- Mitigacion: mantener zero-alloc en loop, benchmarking de eventos por segundo.

Riesgo 3: UX compleja en Learn Mode.
- Mitigacion: iteracion en dos pasos (v1 funcional, v2 refinada), telemetria de uso.

## 7) Definition of Done del siguiente lote

- El operador puede remapear teclas y chords completamente desde UI sin tocar codigo.
- Los cambios persisten entre sesiones y pueden restaurarse.
- No hay conflictos silenciosos: toda colision se detecta y comunica.
- Acciones criticas tienen protecciones activas y testeadas.
- Cmd layer ejecuta al menos 4 comandos base con feedback visual.
- Test suite de KeyForge cubre:
  - asignacion de tecla
  - asignacion de chord
  - deteccion de conflicto
  - persistencia
  - debounce en acciones criticas

## 8) Checklist de planificacion para arquitectura

- Confirmar alcance final de cmd layer v1 (gramatica minima).
- Definir contrato de export/import de perfiles.
- Acordar politicas de seguridad para acciones arb-*.
- Aprobar UX de Learn Mode (layout, navegacion, estados de error).
- Cerrar matriz de pruebas (unitarias + integracion de input).

## 9) Recomendacion de prioridad

Prioridad 1: Learn Mode v1 + Safety Pack v1.
Prioridad 2: Chord Workbench v1.
Prioridad 3: Cmd Layer Foundation.
Prioridad 4: Heatmap y mejoras cosmeticas.
