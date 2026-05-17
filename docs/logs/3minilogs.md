eporte Forense L0 vs L3 (solo auditoría, sin ejecución)

Hallazgos críticos

El “silencio total de L0 cuando pinta L3” no existe como regla global en el árbitro; existe solo por nodo/canal.
Evidencia: L0 se aplica primero y L3 después en el mismo frame en NodeArbiter.ts:459 y NodeArbiter.ts:555.
Evidencia: el bloqueo es por canal tocado de ese nodo con _l3DominatedChannels en NodeArbiter.ts:706, NodeArbiter.ts:738, NodeArbiter.ts:757.
Diagnóstico: si L3 no escribe un canal concreto, L0 puede seguir vivo en ese canal.
CumbiaMoon sí sobreescribe color blanco, pero no neutraliza toda la luminancia de fixture.
Evidencia: CumbiaMoon emite en zonas front/back/all-movers en CumbiaMoon.ts:221.
Evidencia: dimmer bajo (10-30%) en CumbiaMoon.ts:74, CumbiaMoon.ts:224, CumbiaMoon.ts:229, CumbiaMoon.ts:235.
Evidencia: el color de zona se inyecta por COLOR nodes (RGB) y dimmer por IMPACT nodes en selene-aether-adapter.ts:422 y selene-aether-adapter.ts:427.
Diagnóstico: hereda blanco (correcto), pero la luminancia puede seguir recibiendo energía por otros canales/nodos no dominados por L3.
L0 sigue inyectando luminancia por dos rutas: dimmer y brightness.
Evidencia: L0 empuja dimmer para nodos con dimmer físico y brightness para nodos color en LiquidAetherAdapter.ts:271, LiquidAetherAdapter.ts:280, LiquidAetherAdapter.ts:288.
Diagnóstico: aunque L3 domine ciertos canales, si no domina brightness en nodos COLOR, L0 puede seguir “levantando” luz.
En HyperionView 2D, la composición visual favorece fugas de luminancia por diseño de proyección.
Evidencia: el proyector toma dimmerNorm como dimmer o brightness en AetherUIProjector.ts:118.
Evidencia: fusiona luminancia por max en AetherUIProjector.ts:122.
Evidencia: el estado arranca limpio cada frame (no es arrastre histórico) en TitanOrchestrator.ts:1477, TitanOrchestrator.ts:1485, TitanOrchestrator.ts:2034.
Diagnóstico: en simulador, un valor alto de brightness/dimmer en cualquier nodo del fixture puede “asomar beats por detrás” aunque el color ya sea blanco de L3.
Hallazgos de consistencia arquitectónica (importantes)

Conflicto documental LTP/HTP entre adapter y arbiter.
Evidencia: Selene adapter traduce blendMode max a HTP en selene-aether-adapter.ts:46 y lo propaga en selene-aether-adapter.ts:524.
Evidencia: NodeArbiter declara LTP universal inter-capas e indica que mergeStrategy queda “para futuro” en NodeArbiter.ts:788 y NodeArbiter.ts:791.
Diagnóstico: hay desalineación entre lo que el efecto “cree pedir” y lo que el árbitro realmente aplica.
Inconsistencia menor en comentarios vs implementación de canales estrictos.
Evidencia: set real estricto solo strobe/shutter en NodeArbiter.ts:62, mientras comentarios mencionan dimmer/brightness como estrictos en NodeArbiter.ts:661.
Diagnóstico: no explica solo el bug, pero sí complica lectura y diagnóstico operativo.
Conclusión forense

Causa raíz principal: el sistema no hace mute global de L0 cuando entra L3; hace dominación por canal y por nodo.
En CumbiaMoon, el color blanco sí domina, pero la luminancia puede seguir entrando por rutas L0 (dimmer/brightness) en canales o nodos no dominados por L3, y HyperionView lo amplifica al componer dimmer por max.
Sobre tu sospecha bus global LTP/HTP: sí hay conflicto semántico real (adapter declara HTP, arbiter no lo ejecuta), pero el síntoma exacto “color sí, dimmer no” se explica con más fuerza por dominación parcial (canal/nodo) + rutas L0 de brightness/dimmer + composición del proyector.
Pruebas sólidas ya verificadas

No ejecuté runtime, no corrí tests ni toqué código.
La auditoría fue 100% estática sobre flujo L0/L3, router de zonas, adapter de efectos, arbiter y proyección UI.
GPT-5.3-Codex • 0.9x
