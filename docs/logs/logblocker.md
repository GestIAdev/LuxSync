Lee el header exacto del blackout para ver qué está bloqueando qué:

Read senses.ts, lines 19 to 35

console.log está libre en senses.ts. El problema debe estar en Electron — tiene su propio filtro de logs del proceso renderer/worker. Busco si hay algún filtro global adicional:

Ahí está — hay un installConsciousnessFilter en main.ts que intercepta console.log. Leo la función completa:

Read main.ts, lines 89 to 170

Encontrado. El installConsciousnessFilter en main.ts tiene una WHITELIST y bloquea todo lo que no empiece con esos prefijos. Los nuevos logs [🔬 PEAK-SAB], [🔬 PEAK-IPC] y [🔬 BPM-TELEMETRY] no están en la lista. Los añado ahora:

