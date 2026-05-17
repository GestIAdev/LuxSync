# WAVE-4835 — FORENSIC AUDIT
## HyperionView / TheProgrammer: desaparicion de Beam-Optics tras refactor multicelular

Estado: AUDITORIA (sin cambios de codigo)
Fecha: 2026-05-16
Scope: UI render path de TheProgrammer (CONTROLS) en HyperionView/StageSidebar

---

## 1) Sintoma observado

En HyperionView, TheProgrammer deja de mostrar la seccion Beam/Optics (beamsection) para fixtures que si poseen canales opticos (zoom/focus/iris).

Impacto funcional:
- Operador pierde control manual de FOCUS/ZOOM/IRIS desde UI.
- Se percibe como regresion posterior al refactor multicelular (CellRouter + cellRouting).

---

## 2) Cadena de render auditada

Ruta efectiva:
1. HyperionView monta StageSidebar (modo controls por defecto).
2. StageSidebar monta TheProgrammer con isActive=true en tab controls.
3. TheProgrammer delega render de secciones a CellRouter con groups=useAggregatedCapabilityCells(selectedIds).
4. CellRouter consulta SECTION_REGISTRY[group.family].canRender(...).
5. Si canRender retorna false, RoutedCell devuelve null y la seccion no se monta.

Conclusiones de ruta:
- HyperionView/StageSidebar NO bloquean BeamSection.
- El filtro critico esta en el gate declarativo de cellRouting.

---

## 3) Evidencia tecnica (causa raiz)

### 3.1 Gate BEAM excluye role 'primary'
En cellRouting, el predicado de BEAM solo permite render si:
- role es 'beam' o 'decoration', o
- ya existe override activo en payload BEAM.

Problema:
- El pipeline de extraccion asigna role='primary' a nodos BEAM con beam shaping (zoom/focus).
- Por tanto, en estado limpio (sin override previo), esos grupos BEAM quedan filtrados y no se renderizan.

### 3.2 Pipeline BEAM marca shaping como 'primary'
En NodeExtractionPipeline._buildBeamNode:
- hasBeamShaping = zoom || focus
- role = hasBeamShaping ? 'primary' : 'decoration'

Esto es coherente con la semantica del dominio, pero incompatible con el gate actual de UI.

### 3.3 CellRouter aplica gate con hard-stop
RoutedCell:
- if (!meta.canRender(group, override)) return null

No hay fallback posterior. Si el gate falla, BeamBody nunca monta.

### 3.4 BeamBody si soporta optics completos
BeamBody implementa GOBO/PRISM/FOCUS/ZOOM/IRIS correctamente.
No hay evidencia de fallo dentro del body; el problema es pre-montaje por gating.

---

## 4) Veredicto forense

Causa raiz confirmada:
- Regresion de contrato entre:
  - productor de roles (NodeExtractionPipeline: BEAM shaping => role 'primary')
  - consumidor de roles (cellRouting.renderBeamOnlyIfOptical: acepta solo 'beam'|'decoration')

Clasificacion:
- Tipo: bug de integracion semantica post-refactor multicelular
- Severidad: alta (bloquea control manual optics)
- Reproducibilidad: determinista

---

## 5) Riesgos colaterales detectados

1. Dependencia circular del override:
- El gate permite BEAM si ya hay override.
- Pero si la seccion no renderiza, no hay via UI para generar ese override inicial.
- Resultado: deadlock funcional de descubrimiento.

2. Inconsistencia comentario vs implementacion en pipeline:
- Comentario menciona zoom/focus/iris para role primary.
- Implementacion actual calcula shaping con zoom/focus (sin iris).
- No es la causa principal de la desaparicion, pero es deuda semantica abierta.

3. Gap de pruebas:
- No hay tests visibles del contrato canRender BEAM vs role 'primary'.

---

## 6) Propuesta de reparacion (sin aplicar en esta auditoria)

Objetivo: mantener higiene anti-fantasma sin ocultar nodos BEAM validos.

Opcion A (recomendada):
- Ajustar renderBeamOnlyIfOptical para aceptar tambien role 'primary' cuando family=BEAM.
- Regla esperada: role in {'primary','beam','decoration'} OR override BEAM presente.

Opcion B:
- En lugar de depender de role, gatear por family+canales detectados en descriptor.
- Ventaja: menor fragilidad frente a cambios de taxonomia de roles.

Pruebas minimas sugeridas:
1. Fixture con zoom/focus y sin overrides:
- Debe aparecer seccion Beam/Optics.
2. Fixture solo con decoracion optica (gobo/prism):
- Debe aparecer seccion Beam/Optics segun contrato vigente.
3. Fixture sin capacidades BEAM:
- No debe aparecer seccion Beam/Optics.

---

## 7) Evidencias de archivo (anclas)

- Gate BEAM restrictivo (role 'beam'|'decoration'):
  electron-app/src/components/hyperion/controls/cellRouting.ts

- Gate hard-stop en router (canRender -> return null):
  electron-app/src/components/hyperion/controls/CellRouter.tsx

- Produccion de role BEAM='primary' para shaping:
  electron-app/src/core/aether/ingestion/NodeExtractionPipeline.ts

- Body Beam/Optics funcional (FOCUS/ZOOM/IRIS):
  electron-app/src/components/hyperion/controls/BeamSection.tsx

- Montaje Hyperion -> Sidebar -> TheProgrammer (sin bloqueo de Beam):
  electron-app/src/components/hyperion/views/HyperionView.tsx
  electron-app/src/components/hyperion/controls/sidebar/StageSidebar.tsx
  electron-app/src/components/hyperion/controls/TheProgrammer.tsx

---

## 8) Cierre

No se detecta fallo de render en HyperionView ni en contenedor sidebar.
El incidente es una incompatibilidad de criterios entre extraction-role y UI-gating en el refactor multicelular.
