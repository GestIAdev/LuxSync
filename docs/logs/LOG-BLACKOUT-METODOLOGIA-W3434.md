# Reporte tecnico: arquitectura de filtros de log (blackout)

## 1) Objetivo
Este documento describe como esta montado el blackout de logs en Electron App, cuales son sus gates reales, de que archivos depende y como puentearlo sin romper la arquitectura.

Tambien deja una metodologia de telemetria para calibrar LiquidEngine sin repetir bloqueos de visibilidad.

## 2) Mapa de gates (orden real de ejecucion)
1. Gate A (Main process): whitelist de consola en electron/main.ts.
2. Gate B (runtime compilado): mismo whitelist en dist-electron-backend/electron/main.js.
3. Gate C (worker local): blackout por worker (senses, mind, GodEarFFT).
4. Gate D (routing): worker -> ALPHA via MessageType.FORENSIC_LOG.
5. Gate E (audio path): AudioMatrix decide fuente activa; puede descartar IPC por source gate.
6. Gate F (worker IPC gag): en BETA, AUDIO_BUFFER se descarta temprano si SAB esta activo.

## 3) Dependencias de archivos
### 3.1 Filtro principal (whitelist)
- electron-app/electron/main.ts
  - installConsciousnessFilter reemplaza console.log/info/debug/warn con filtro por prefijo.
  - console.error queda libre (sin filtro).

- electron-app/dist-electron-backend/electron/main.js
  - Version runtime compilada del mismo filtro.
  - Si esta desalineada con main.ts, veras comportamiento diferente en ejecucion real.

### 3.2 Blackout de workers
- electron-app/src/workers/senses.ts
  - Bloquea solo console.info y console.debug.
  - Deja console.log/warn/error.

- electron-app/src/workers/mind.ts
  - Blackout total (console.log/info/debug/warn/error).

- electron-app/src/workers/GodEarFFT.ts
  - Blackout total (console.log/info/debug/warn/error).

### 3.3 Puentes de telemetria
- electron-app/src/workers/WorkerProtocol.ts
  - MessageType.FORENSIC_LOG para subir telemetria desde worker.

- electron-app/src/workers/TrinityOrchestrator.ts
  - case MessageType.FORENSIC_LOG: reimprime por main como [TitanOrchestrator] ...

- electron-app/src/core/orchestrator/IPCHandlers.ts
  - [IPC AUDIT] para auditar entrada de lux:audio-buffer y activeSource.

### 3.4 Gate de fuente de audio
- electron-app/src/core/audio/AudioMatrix.ts
  - ingestAudio solo acepta buffers de la fuente efectiva (activeSource/forcedSource).
  - Si entra IPC pero activeSource no es legacy-bridge, el buffer se ignora.

- electron-app/src/workers/senses.ts
  - En MessageType.AUDIO_BUFFER, IPC gag de WAVE 3434: return temprano si sabPollInterval activo.

## 4) Metodologia recomendada para telemetria (LiquidEngine)
### Fase 1: Confirmar visibilidad de canal
1. Emitir una linea de control con prefijo whitelisted desde main:
   - [TitanOrchestrator] [TELEMETRY PROBE] ...
2. Si no aparece, revisar main.ts y dist-electron-backend/main.js.

### Fase 2: Elegir canal segun origen
1. Log originado en main:
   - Usar prefijo whitelisted.
2. Log originado en worker:
   - Opcion A: console.error (pasa siempre por Gate A).
   - Opcion B (recomendada): MessageType.FORENSIC_LOG -> TrinityOrchestrator -> [TitanOrchestrator] ...

### Fase 3: Correlacion de fuente y contaminacion
1. Mantener [IPC AUDIT] activo temporalmente.
2. Correlacionar activeSource con:
   - Sab feed ([VirtualWire] ...)
   - MATH AUDIT
   - BPM/beat
3. Si activeSource=virtual-wire y sigue llegando IPC:
   - Es expected upstream residual.
   - AudioMatrix lo gatea.
   - BETA (W3434) ya descarta por IPC gag si SAB activo.

## 5) Como puentear o desactivar blackout por tipo de log
### Caso A: Quiero ver un log de main process
1. Prefijar con una entrada de WHITELIST en main.ts.
2. Reflejar el mismo prefijo en dist-electron-backend/electron/main.js para runtime inmediato.
3. Reiniciar electron dev.

### Caso B: Quiero ver log de worker sin tocar whitelist
1. Usar console.error en worker.
2. O enviar MessageType.FORENSIC_LOG con texto ya prefijado ([MATH AUDIT], [ZOMBIE RADAR], etc).

### Caso C: Quiero desactivar filtro temporalmente (debug bruto)
1. En electron/main.ts, comentar el bloque installConsciousnessFilter.
2. Repetir en dist-electron-backend/electron/main.js si ejecutas artefacto compilado.
3. Volver a activarlo al cerrar auditoria.

### Caso D: Quiero desactivar blackout en worker especifico
1. senses.ts:
   - Comentar IIFE que pisa console.info/debug.
2. mind.ts y GodEarFFT.ts:
   - Comentar IIFE de blackout total.
3. Mantener ventana corta de auditoria para evitar spam/overhead.

## 6) Checklist operativo rapido (antes de auditar)
1. Confirmar canal de ejecucion: electron:dev vs runtime compilado.
2. Confirmar que main.ts y dist-electron-backend/main.js tienen el mismo WHITELIST.
3. Confirmar donde nace el log (main o worker).
4. Para worker, preferir FORENSIC_LOG sobre console.log directo.
5. Activar [IPC AUDIT] solo durante calibracion.
6. Al terminar, retirar logs ruidosos y dejar solo probes esenciales.

## 7) Riesgos y mitigaciones
1. Riesgo: editar solo main.ts y olvidar dist runtime.
   - Mitigacion: validar ambos archivos en cada cambio de whitelist.
2. Riesgo: mezclar ruido de renderer/worker y sacar conclusiones falsas.
   - Mitigacion: usar [TitanOrchestrator] como canal canonico de auditoria.
3. Riesgo: degradacion por spam de logs.
   - Mitigacion: throttling por tiempo (1-2s) y remover probes despues de calibrar.

## 8) Estado actual (W3434)
1. Ventana de mapeo perceptual ajustada a realidad de runtime (0..8 dB).
2. IPC gag estricto activo en BETA cuando SAB poll esta activo.
3. [IPC AUDIT] visible en main para validar residuos de legacy IPC.
4. Puente FORENSIC_LOG activo para trazas de worker sin perderse en blackout.
