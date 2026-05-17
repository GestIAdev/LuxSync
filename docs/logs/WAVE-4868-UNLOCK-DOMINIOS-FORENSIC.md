# WAVE 4868 — Informe Forense de Unlocks L2 en HyperionView

## Mandato de auditoría

Objetivo solicitado:

- Verificar por qué el botón Unlock de Kinetic Cathedral termina desbloqueando TODO L2.
- Probar si los dominios de unlock entre TheProgrammer y Cathedral están mezclados.
- Entregar diagnóstico read-only, sin ejecutar código.

## Veredicto ejecutivo

Existe una fuga de dominio confirmada.

- El Unlock de Cathedral está cableado al kill switch global `releaseAll()`.
- `releaseAll()` marca sucias todas las familias L2: IMPACT, COLOR, KINETIC, BEAM, EXTRAS.
- El bridge de salida convierte ese estado en clears L2 para todos los nodeIds de esas familias.
- Resultado operativo: al liberar movimiento desde Cathedral se limpian también color/intensidad/strobe/beam.

Esto contradice explícitamente la doctrina de separación ya documentada en el store, donde Cathedral debería usar `releaseKinetics()` y TheProgrammer debería usar `releaseProgrammer()`.

## Pruebas forenses

### 1) HyperionView sí monta Cathedral como centro de movimiento

En HyperionView, cuando `sidebarMode` es kinetics, el panel activo es KineticsCathedral:

- [electron-app/src/components/hyperion/views/HyperionView.tsx](electron-app/src/components/hyperion/views/HyperionView.tsx#L434)
- [electron-app/src/components/hyperion/views/HyperionView.tsx](electron-app/src/components/hyperion/views/HyperionView.tsx#L437)

Conclusión: el botón UNLOCK de Cathedral entra por este componente y no por un panel legacy externo.

### 2) TheProgrammer ya está divorciado correctamente

El handler del botón de TheProgrammer usa `releaseProgrammer()` y no `releaseAll()`:

- [electron-app/src/components/hyperion/controls/TheProgrammer.tsx](electron-app/src/components/hyperion/controls/TheProgrammer.tsx#L190)
- [electron-app/src/components/hyperion/controls/TheProgrammer.tsx](electron-app/src/components/hyperion/controls/TheProgrammer.tsx#L197)
- [electron-app/src/components/hyperion/controls/TheProgrammer.tsx](electron-app/src/components/hyperion/controls/TheProgrammer.tsx#L198)

Además, en ese mismo archivo se deja explícito que `releaseAll()` es nuclear y no debe ser el unlock normal de controles:

- [electron-app/src/components/hyperion/controls/TheProgrammer.tsx](electron-app/src/components/hyperion/controls/TheProgrammer.tsx#L202)
- [electron-app/src/components/hyperion/controls/TheProgrammer.tsx](electron-app/src/components/hyperion/controls/TheProgrammer.tsx#L207)

Conclusión: TheProgrammer está alineado con el divorcio de dominios.

### 3) KineticsCathedral está llamando al kill switch global

El handler de UNLOCK en Cathedral invoca `useProgrammerStore.getState().releaseAll()`:

- [electron-app/src/components/hyperion/kinetics/KineticsCathedral.tsx](electron-app/src/components/hyperion/kinetics/KineticsCathedral.tsx#L126)
- [electron-app/src/components/hyperion/kinetics/KineticsCathedral.tsx](electron-app/src/components/hyperion/kinetics/KineticsCathedral.tsx#L130)

El propio comentario en ese handler lo declara como Unlock TOTAL:

- [electron-app/src/components/hyperion/kinetics/KineticsCathedral.tsx](electron-app/src/components/hyperion/kinetics/KineticsCathedral.tsx#L127)

Conclusión: la fuga no es accidental por efecto colateral, está cableada de forma directa.

### 4) El contrato del store dice exactamente lo contrario

La interfaz del store documenta separación de responsabilidades:

- `releaseProgrammer()` para Unlock Controls del Programmer.
- `releaseKinetics()` para Unlock Cathedral del KineticsCathedral.

Evidencia:

- [electron-app/src/stores/programmerStore.ts](electron-app/src/stores/programmerStore.ts#L293)
- [electron-app/src/stores/programmerStore.ts](electron-app/src/stores/programmerStore.ts#L303)

Conclusión: hay contradicción entre contrato y wiring real en UI de Cathedral.

### 5) Qué hace `releaseAll()` en realidad

`releaseAll()` no es parcial. Activa limpieza total por familias:

- Setea dirty para `IMPACT`, `COLOR`, `KINETIC`, `BEAM`, `EXTRAS`.

Evidencia:

- [electron-app/src/stores/programmerStore.ts](electron-app/src/stores/programmerStore.ts#L978)
- [electron-app/src/stores/programmerStore.ts](electron-app/src/stores/programmerStore.ts#L993)

Conclusión: al invocarlo desde Cathedral, ya queda ordenado el barrido de todo L2 del Programmer.

### 6) Cómo esa orden termina en clears reales L2

El bridge recorre `dirtyFamilies` y para cada fixture/familia decide set o clear por nodeId. Cuando no hay canales activos, agrega clear del nodo completo:

- [electron-app/src/bridges/ProgrammerAetherBridge.ts](electron-app/src/bridges/ProgrammerAetherBridge.ts#L498)
- [electron-app/src/bridges/ProgrammerAetherBridge.ts](electron-app/src/bridges/ProgrammerAetherBridge.ts#L505)
- [electron-app/src/bridges/ProgrammerAetherBridge.ts](electron-app/src/bridges/ProgrammerAetherBridge.ts#L560)

Mapeo de familias a nodos afectados:

- IMPACT → impact
- COLOR → color
- KINETIC → kinetic
- BEAM → beam
- EXTRAS → atmosphere

Referencia:

- [electron-app/src/bridges/ProgrammerAetherBridge.ts](electron-app/src/bridges/ProgrammerAetherBridge.ts#L68)

Conclusión: el desbloqueo de Cathedral llega a clears de color/intensidad/beam porque el dirty global se transforma en clear global de nodeIds.

## Hallazgo secundario

Existe un footer de Cathedral con botón propio de unlock que usa `releasePosition()` (solo cinético), pero no está integrado en el render actual de KineticsCathedral:

- Implementación del footer: [electron-app/src/components/hyperion/kinetics/CathedralFooter.tsx](electron-app/src/components/hyperion/kinetics/CathedralFooter.tsx#L55)
- KineticsCathedral no lo renderiza en su JSX actual: [electron-app/src/components/hyperion/kinetics/KineticsCathedral.tsx](electron-app/src/components/hyperion/kinetics/KineticsCathedral.tsx#L260)

Esto sugiere dos caminos históricos coexistiendo:

- camino nuevo del mode bar con UNLOCK total,
- camino footer parcial no activo.

## Diagnóstico causal final

Cadena causal confirmada:

1. Usuario pulsa UNLOCK en Kinetic Cathedral.
2. `handleUnlockKinetics` llama `releaseAll()`.
3. `releaseAll()` marca dirty en todas las familias L2.
4. ProgrammerAetherBridge transforma ese dirty en clears multi-familia por nodeId.
5. Se liberan también color/intensidad/strobe/beam además del dominio de movimiento.

Esto explica exactamente el síntoma observado en HyperionView.

## Impacto funcional

Impacto directo al flujo operador:

- Liberar un patrón de movimiento o reposicionar movers en Cathedral también mata locks de color/intensidad/beam del mismo fixture.
- TheProgrammer y Cathedral dejan de ser reinos separados y se pisan mutuamente en L2.

Riesgo de show:

- Pérdida de intención artística en vivo por unlock transversal no deseado.
- Operador interpreta “unlock movimiento” pero recibe “unlock total”.

## Criterio de corrección arquitectónica

Para cumplir el mandato de separación de dominios:

- TheProgrammer: unlock debe seguir en `releaseProgrammer()`.
- Cathedral: unlock debe ir por `releaseKinetics()` y sus limpiezas de motor/patrón asociadas.
- `releaseAll()` debe quedar reservado a reset nuclear explícito.

No se realizaron cambios en código en esta auditoría. Solo trazado forense con evidencia estática.
