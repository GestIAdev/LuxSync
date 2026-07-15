Análisis Forense del Log
Timeline de disparos (~60s de techno-minimal)
#	Efecto	Ruta	E	Z	epicness	I(t)	phase	huntW	Duración
1	Abyssal Rise	DNA execute	0.98	1.24σ	0.173	0.697	textural	0.000	3800ms
2	depo	DNA execute	0.55	-0.53σ	0.105	0.948	building	0.000	6000ms
3	Solar Flare	DIVINE (ep>0.6)	0.87	1.11σ	0.669	1.000	textural	0.000	1500ms
4	Void Mist	DNA execute	0.81	0.72σ	0.151	0.626	climax	0.800	3000ms
5	Abyssal Rise	Cassandra Sovereign	—	—	—	—	—	—	3800ms
6	Deep Breath	DNA execute	0.85	0.81σ	0.287	1.000	building	0.000	5000ms
7	Acid Sweep	DNA execute	0.75	0.29σ	0.287	1.000	building	0.000	4000ms
8	Cyber Dualism	DNA execute	0.81	0.62σ	0.279	0.991	building	0.000	3000ms
9	Seismic Snap	Cassandra Sovereign	—	—	—	—	—	—	2500ms
10	Void Mist	DNA execute	0.77	0.43σ	0.210	0.908	building	0.000	3000ms
10 disparos en ~60s = 10 EPM. Sin cooldown, efectos se solapan (hasta 2 clips simultáneos).

5 Bugs raíz identificados
BUG 1: Tensión STUCK en 0.850 — Epicness binario
En los 30+ snapshots de [FLUID-DIAG], tension es **siempre 0.850. effectiveTension = 0.850 * 0.50 = 0.425siempre. Esto crea un **acantilado** enbaseEpicness = (impact - 0.425) / 0.575`:

impact < 0.425 → epicness = 0 (silencio)
impact > 0.425 → epicness salta a 0.1-0.5 (dispara)
No hay gradiente. Es un interruptor binario.

BUG 2: Impact es extremadamente volátil
Impact salta de 0.2 a 0.9 en un solo frame. Ejemplos:

Línea 205: impact=0.194 → línea 214: impact=0.918 (FLASHBANG detectado)
Línea 237: impact=0.209 → línea 248: impact=1.000 (FIRE Deep Breath)
Línea 294: impact=0.155 → línea 308: impact=0.621
Un solo frame con zH alto (zH=3.33 en línea 214) dispara impact de 0.19 a 0.92. El Gatekeeper bloquea en el frame anterior y aprueba en el siguiente.

BUG 3: huntW = 0.000 en 9 de 10 disparos
El HuntEngine reporta worthiness=0.000 y confidence=0.300 en prácticamente todos los disparos. El HuntEngine no está contribuyendo a la decisión. El único frame con huntW=0.800 fue el Void Mist #4. Sin huntW, el DecisionMaker depende exclusivamente del DNA.

BUG 4: Gatekeeper es una criba, no una puerta
Patrón repetido en CADA disparo DNA:

Frame A: Gatekeeper bloquea (epicness < 0.10)
Frame B (ms después): impact spike → epicness > 0.10 → DecisionMaker aprueba → FIRE
El Gatekeeper trabaja frame-a-frame. Como impact es volátil, bloquea en un frame y pasa en el siguiente. No previene nada, solo retrasa unos frames.

BUG 5: Cassandra Sovereign Clock bypassa TODO
Los disparos #5 y #9 (Abyssal Rise, Seismic Snap) vienen por Cassandra Sovereign Clock, que no pasa por Gatekeeper, ni por HuntEngine, ni por epicness check. No hay [FIRE-DIAG] para estos. Cassandra dispara lo que pre-buferizó hace 2-3s sin verificar si la música sigue justificando el efecto.

Plan de ataque propuesto**
Teniendo en cuenta los 5 bugs identificados, ¿por cuál empezamos?

Command Awaiting Approval
Teniendo en cuenta los 5 bugs identificados, ¿por cuál empezamos?


Bug 1: Tensión stuck
Investigar por qué tension nunca cambia de 0.850 en CognitiveFluidState. Es la causa raíz del epicness binario. Sin arreglar esto, nada más importa.

Bug 2+4: Smooth impact + Gatekeeper temporal
Agregar smoothing temporal a impact (EMA window) para que no salte 0.2→0.9 en 1 frame. Y cambiar Gatekeeper de frame-a-frame a ventana deslizante (epicness promedio en N frames, no valor instantáneo).

Bug 3: HuntEngine muerto
Investigar por qué huntW=0.000 siempre. El HuntEngine debería ser el primer gate antes del DNA. Si está muerto, el DNA tiene vía libre.

Bug 5: Cassandra sin gates
Hacer que Cassandra Sovereign Clock respete epicness. Actualmente bypassa todo y dispara lo que pre-buferizó sin verificar realidad acústica actual.