Veredicto WAVE 4735.7 (sin tocar código)
Sí hay causa raíz arquitectónica clara: existe split-brain entre la ruta multicell y la ruta legacy por doble extracción de nodos desde fuentes distintas. El síntoma de índices duplicados aparece como efecto secundario cuando se cae a channels planos en vez de usar graph.

Hallazgos

Crítico: doble fuente de verdad para NodeId (frontend vs backend), con riesgo real de mismatch multicell/legacy.
Pruebas:
Frontend construye células con su propia extracción: useCapabilityCells.ts:324, useCapabilityCells.ts:327.
CellKey se deriva del sufijo del nodeId generado en frontend: useCapabilityCells.ts:193, useCapabilityCells.ts:195, useCapabilityCells.ts:220.
Backend resuelve definición por runtime library primero: TitanOrchestrator.ts:2875, TitanOrchestrator.ts:2885.
El extractor backend solo usa fixtureDef.nodeGraph para entrar en path Forge: NodeExtractionPipeline.ts:384, NodeExtractionPipeline.ts:387, NodeExtractionPipeline.ts:388, NodeExtractionPipeline.ts:395.
El forgeGraph del fixture se pasa para evaluator, pero no como fuente de NodeId para extracción: TitanOrchestrator.ts:2842.
Conclusión:

Si frontend y backend no parten de la misma definición efectiva, uno puede operar con IDs tipo wash-color/impact-golden y el otro con color/impact legacy.
Alto: el sistema puede tragarse IDs inválidos en silencio, provocando blackout sin error duro.
Pruebas:
Bridge prioriza capa cell y bloquea legacy para nodeIds cubiertos: ProgrammerAetherBridge.ts:445, ProgrammerAetherBridge.ts:457, ProgrammerAetherBridge.ts:504, ProgrammerAetherBridge.ts:496.
Arbiter acepta y guarda override L2 por nodeId sin validar existencia en grafo: NodeArbiter.ts:393, NodeArbiter.ts:397.
Resolver descarta nodeId desconocido con return silencioso: NodeResolver.ts:725, NodeResolver.ts:726, NodeResolver.ts:727.
Conclusión:

Este patrón explica perfecto un “L2 activo” en logs con DMX negro real.
Medio: warning de índices duplicados existe, pero apunta más a caída al path channels plano que a causa primaria.
Pruebas:
Warning explícito de duplicados y reasignación posicional en Titan: TitanOrchestrator.ts:2939.
En el hook ya está documentado que el fallback puede colapsar topología multicell a un esquema plano: useCapabilityCells.ts:313.
Conclusión:

El warning de footprint/index es un detector útil de degradación, pero el problema raíz es pérdida de autoridad del graph en alguna rama.
Diagnóstico solicitado (respuesta directa)

Hipótesis 1 (multicell no reemplaza legacy de forma consistente): Confirmada.
Hipótesis 2 (mismatch de ID entre generación y resolución): Confirmada.
Hipótesis 3 (índices duplicados como origen principal): Parcial. Es más un síntoma de degradación hacia fallback plano.
Propuesta arquitectónica compatible (sin romper V1)

Única fuente de verdad de células desde backend.
Backend debe exponer catálogo real de NodeId ya registrados en NodeGraph y frontend debe dejar de re-extraer topología localmente.

Precedencia determinista de definición para extracción backend.
Al sincronizar fixtures, usar primero graph runtime del fixture activo (forgeGraph/nodeGraph del show) y solo luego runtime library/channels legacy.

Modo estricto graph-first.
Si existe nodeGraph, prohibir toda normalización de índices y todo fallback a buildAllNodes para ese fixture.

Guardarraíl de integridad L2.
Contador y warning explícito de drop por nodeId no encontrado en resolver para no tener blackout silencioso.

Compatibilidad V1.
Si fixture no trae nodeGraph, mantener exactamente la ruta legacy actual.

No hice cambios de código en esta fase, solo forensics y diagnóstico arquitectónico. Si quieres, en el siguiente paso te propongo un plan de implementación por fases con impacto y orden de riesgo mínimo.