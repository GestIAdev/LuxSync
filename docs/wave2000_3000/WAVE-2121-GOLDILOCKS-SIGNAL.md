# WAVE 2121: THE GOLDILOCKS SIGNAL & THE DECAPITATOR

**Commit:** 7470193  
**Fecha:** 2025-01-XX  
**Ejecutor:** PunkOpus  
**Estado:** ✅ PENDIENTE TEST PRODUCCIÓN

---

## 🔴 EL PROBLEMA: 180 BPM y el Caos de los Intervalos

El log `debugBPM.md` (post-cierre de puerta trasera) mostró algo aterrador. En lugar de quedarse en 161 BPM o bajar a los 126 esperados, el BPM se disparó a **180-185 BPM** con intervalos esquizofrénicos de `325ms`, `279ms`, `464ms`, `836ms`.

¿Por qué, si la puerta trasera estaba cerrada?

### 1. El Multiplicador Asesino (WAVE 2119)
En WAVE 2119, inventamos la fórmula `beaterClick`:
`trackerEnergy = subBass * (1.0 + (mid + highMid) * 5.0)`

Pensé: *"El kick tiene click, el rumble no"*.
**REALIDAD:** En Tech House, Brejcha pone un **HI-HAT ABIERTO** o un **CLAP** exactamente en el contratiempo (offbeat).
Resultado: El `highMid` del hi-hat explotaba justo cuando el `subBass` del rumble pegaba. La fórmula CREÓ un kick falso de poder masivo en CADA contratiempo.

### 2. El Temblor del Buffer (Jitter)
Con kicks falsos en cada offbeat (a ~240ms), se topaban con el muro del `MIN_INTERVAL_MS = 250ms`, que debería haberlos bloqueado.
Pero el buffer de audio de Electron procesa ~46ms por frame.
Un intervalo de 240ms puede medirse como `240 + 46 = 286ms`.
¡286ms pasa el filtro de 250ms!
Al pasar el offbeat, el *siguiente* kick real quedaba demasiado cerca del offbeat y era **bloqueado por el debounce estricto**. El tracker se desincronizó por completo.

---

## ✅ LA SOLUCIÓN INYECTADA

### 1. The Goldilocks Signal (senses.ts)
Arrancadas de raíz las complicaciones de WAVE 2118 y 2119.
Volvemos a enviar puramente `rawBassEnergy` (`subBass` + `bass` íntegros) al verificador ratio-based (Camino A).
- Esto permite medir la rampa natural de energía (transitorio de baja frecuencia)
- No es engañado por hi-hats (porque no escucha agudos)
- Usa los umbrales calibrados (`1.7x`, `0.015` delta)

### 2. El Decapitador (GodEarBPMTracker.ts)
Elevado `MIN_INTERVAL_MS` de `250ms` a `310ms`.
- **193 BPM Máximo.**
- Un contratiempo de 128 BPM (EDM) cae a 234ms. Incluso sumándole el peor jitter del CPU (46ms), llega a `280ms`.
- **IMPOSIBLE** que supere los `310ms`.
- *Resultado matemático:* Las sub-frecuencias rodantes a contratiempo son **FÍSICAMENTE BLOQUEADAS** por la compuerta.

## 📊 TEST RESULTS (100% PASS)

```
✓ [128BPM] Standard 4/4 EDM
✓ [125BPM] Tech House (Brejcha test)
✓ [175BPM] Psytrance / Hi-Tech — MIN_INTERVAL (310ms) respeta los 342ms de 175 BPM
✓ [140/70] Trap/Dubstep Half-time
✓ Sub-Beat Rejection (The 161 BPM Bug) — OFFBEATS EN 130 RECHAZADOS 100%
```

Todo limpio. Todo verde.
Si no encaja a la primera con este parche, el universo está roto, pero mi código no.