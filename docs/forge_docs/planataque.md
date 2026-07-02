> **🎯 ROL:** CHIEF SYSTEMS ARCHITECT & COMPILER ENGINEER
> **PROYECTO:** LuxSync — The Forge Core & Aether Engine Ingestion
> **OPERACIÓN:** WAVE 7122 — Structural Foundation Repair Pipeline
>
> **CONTEXTO:**
> El informe técnico WAVE 7121 reveló fallas críticas de consistencia y aislamiento en el constructor de fixtures (src/components/views/forgeview/ y src/core/forge/)[cite: 9]. Vamos a subsanar de forma definitiva las grietas del compilador y el bus de intents antes de realizar pruebas masivas con el 7R y el Tungsten compuesto[cite: 9].
>
> **INSTRUCCIONES DE EJECUCIÓN CRUCIALES (6 PUNTOS COMPLETOS):**
>
> **1. RESOLUCIÓN DE CONTAMINACIÓN ENTRE CÉLULAS (Cross-Cell Isolation):**
> - **Problema:** El IntentBus y el NodeResolver enrutan los comandos basándose estrictamente en el channelKey global, provocando que un intent de estrobo afecte a múltiples células independientes con el mismo tipo de canal (ej. el estrobo dorado y el washer se solapan)[cite: 9].
> - **Acción:** Modifica el distribuidor del IntentBus de Aether para que evalúe y filtre cruzando el channelKey con el aetherNodeId de destino[cite: 9]. Si un intent va dirigido a una zona o célula específica, la aduana de intents debe ignorar los canales homónimos de las células vecinas[cite: 9].
>
> **2. UNIFICACIÓN DE ÍNDICES DMX (Base-0 Enforcement - Bug W-1):**
> - **Problema:** Inconsistencia grave donde NodeGraphBuilder.ts usa un offset base 0 (channel.index - 1) y compileForgeState.ts escribe un offset base 1 (ch.index)[cite: 9]. Esto desplaza +1 canal la ejecución de los fixtures guardados vía Aether Cells[cite: 9].
> - **Acción:** Modifica compileForgeState.ts para que todas las operaciones de cálculo de dmxOffset y el bucle de compilación del grafo de salida utilicen estrictamente índices basados en 0[cite: 9]. Garantiza simetría matemática exacta con el constructor del grafo visual[cite: 9].
>
> **3. RECONCILIACIÓN PRO-GRAFO (Dual Source of Truth - Bug W-2):**
> - **Problema:** El guardado ejecuta syncGraphOutputsWithChannels(), destruyendo las modificaciones manuales avanzadas realizadas en las configuraciones de los nodos del Grafo al ser pisados ciegamente por el Rack de Canales[cite: 9].
> - **Acción:** Invierte la dominancia o implementa un merge inteligente[cite: 9]. Si un nodo output_dmx en forgeGraphStore.graph ya posee parámetros extendidos específicos (como asignación manual de sub-nodos o dependencias complejas), el pipeline de guardado debe preservar estas propiedades en lugar de destruirlas con el estado plano del rack[cite: 9].
>
> **4. ELIMINACIÓN DE LA DOBLE COMPILACIÓN (Redundant Build - Bug W-3):**
> - **Problema:** El método compileForgeState() se invoca de manera redundante tanto dentro de buildCompleteFixture() como en el hook de guardado de FixtureForgeEmbedded, generando riesgos de divergencia de estado[cite: 9].
> - **Acción:** Centraliza el flujo[cite: 9]. La compilación estructural del perfil debe ocurrir una única vez dentro de la tubería pura de ensamble de buildCompleteFixture[cite: 9]. Limpia los callbacks de la UI para que consuman el resultado unificado[cite: 9].
>
> **5. DESAMBIGUACIÓN LOCAL DE IGNITION DEPS (Ignition Ambiguity - Bug W-5):**
> - **Problema:** Cuando existen múltiples canales del mismo tipo distribuidos en distintas células del fixture compuesto, la resolución automática por channelType falla por ambigüedad[cite: 9].
> - **Acción:** Refactoriza resolveChannelDeps en compileForgeState.ts[cite: 9]. Al buscar un canal objetivo para una dependencia de ignición, el compilador debe buscar primero si existe un canal que coincida *dentro de la misma célula lógica*[cite: 9]. Si hay un match local, se auto-resuelve el targetChannelIndex eliminando el conflicto global[cite: 9].
>
> **6. RESTAURACIÓN DEL TIPO IRIS EN LA PALETA (Missing Function - Bug W-7):**
> - **Problema:** El tipo de canal iris está contemplado por las reglas del motor pero falta físicamente en la paleta visual, impidiendo su asignación[cite: 9].
> - **Acción:** Inserta el chip de función iris dentro de la categoría BEAM en el objeto FUNCTION_PALETTE de FixtureForgeEmbedded.tsx[cite: 9].
>
> **CRITERIOS DE ACEPTACIÓN ESTRICTOS:**
> - Compilación limpia: tsc --noEmit con código de salida 0[cite: 9].
> - Verificación: Generación de un perfil JSON de prueba del Tungsten multicélula donde los offsets DMX coincidan en base 0, las células estén aisladas y no haya pérdida de datos de nodos al guardar[cite: 9].