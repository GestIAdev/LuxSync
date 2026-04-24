# Auditoria Tecnica #9 - WAVE 3467
## Audio Connectivity Core (MIC - VW - USB - OSC)

Fecha: 2026-04-23  
Repositorio: LuxSync  
Objetivo: documentar el funcionamiento real de captura/ruteo de audio y validar la natividad de Virtual Wire.

---

## 1) Resumen Ejecutivo

### Veredicto de negocio sobre Virtual Wire
- Virtual Wire NO es un driver propietario embebido en LuxSync.
- Virtual Wire es un proveedor de captura nativa que usa APIs del sistema (WASAPI/CoreAudio/JACK) a traves de un addon C++/Node.
- Para funcionar como "cable virtual" en Windows/macOS, depende de que exista un endpoint virtual instalado en el sistema (ej: VB-Cable/BlackHole/Loopback).

### Respuesta directa al cliente final
- En instalacion limpia, el boton VW no garantiza captura interna por si solo.
- Sin software/driver virtual de terceros, VW puede quedar sin dispositivo objetivo.
- Si el cliente quiere capturar audio interno sin instalar cable virtual, hoy la ruta funcional nativa en UI es SYSTEM (captura browser via getDisplayMedia), no VW.

---

## 2) Alcance Auditado

Archivos solicitados:
- electron-app/native/src/platform/wasapi_capture.cpp
- electron-app/native/src/platform/coreaudio_capture.cpp
- electron-app/native/src/platform/jack_capture.cpp
- electron-app/src/components/views/DashboardView/components/SystemsCheck.tsx
- electron-app/src/stores/truthStore.ts

Archivos complementarios auditados para cerrar trazabilidad funcional:
- electron-app/src/providers/TrinityProvider.tsx
- electron-app/src/hooks/useAudioCapture.ts
- electron-app/src/core/audio/AudioMatrix.ts
- electron-app/src/core/audio/VirtualWireProvider.ts
- electron-app/src/core/audio/USBDirectLinkProvider.ts
- electron-app/src/core/audio/OSCNexusProvider.ts
- electron-app/native/src/common.h

---

## 3) Naturaleza del Virtual Wire (VW)

## 3.1 Arquitectura real
- El motor nativo expone captura por plataforma mediante createCaptureStream():
  - Windows: WASAPI (wasapi_capture.cpp)
  - macOS: CoreAudio AUHAL (coreaudio_capture.cpp)
  - Linux: JACK (jack_capture.cpp)
- VirtualWireProvider usa NativeAudioBridge para enumerar dispositivos y arrancar captura nativa.
- En Windows loopback, abre endpoint eRender con AUDCLNT_STREAMFLAGS_LOOPBACK.
- En macOS/Linux aplica el backend nativo equivalente, pero la nocion "virtual wire" depende del dispositivo disponible en el sistema.

## 3.2 Dependencia de terceros
- VirtualWireProvider auto-busca nombres como CABLE Input, VB-Cable, BlackHole, Voicemeeter, Virtual Audio.
- Si no encuentra uno, queda en estado de error/no device.

## 3.3 Conclusiones
- LuxSync no instala su propio driver kernel de cable virtual.
- LuxSync si implementa captura nativa low-level, pero sobre dispositivos del SO.
- VW es "nativo en engine", no "autonomo sin endpoint virtual".

---

## 4) Mapeo Funcional UI -> Motor

## 4.1 MIC
Flujo:
1. SystemsCheck selecciona microphone.
2. Trinity llama startMicrophone().
3. useAudioCapture usa navigator.mediaDevices.getUserMedia().
4. Se procesa en AudioContext a 44100 Hz y se envian frames por pipeline legacy-bridge.

Detalles tecnicos:
- Se desactivan echoCancellation, noiseSuppression y autoGainControl (false).
- Seleccion de input prioriza line-in/jack por etiqueta; si no hay, fallback a primer micro disponible.

Conclusiones MIC:
- Es ruta WebAudio/browser, no driver nativo directo.
- No hay filtros browser de cancelacion/ruido activos por defecto.

## 4.2 VW
Flujo:
1. SystemsCheck selecciona virtual-wire.
2. Trinity activateOmniSource('virtual-wire').
3. AudioMatrix forceSource('virtual-wire').
4. VirtualWireProvider arranca NativeAudioBridge.startCapture().
5. En Windows loopback: WASAPI shared + STREAMFLAGS_LOOPBACK sobre endpoint eRender.

Frecuencia de muestreo y formato:
- Objetivo del provider: 44100 Hz.
- WASAPI shared intenta Float32; si hace falta, usa AUTOCONVERTPCM + SRC_DEFAULT_QUALITY.
- Si la tasa origen difiere, provider aplica resampler.

Captura endpoint:
- Loopback del render endpoint (tipicamente default o device configurado), no captura microfono.

## 4.3 USB
Flujo:
1. SystemsCheck selecciona usb-directlink.
2. Trinity activateOmniSource('usb-directlink').
3. AudioMatrix forceSource('usb-directlink').
4. USBDirectLinkProvider enumera y abre captura nativa en modo exclusive cuando corresponde.

Como decide que dispositivo usar:
- No valida explicitamente "bus USB" por VID/PID en la logica principal.
- Elige primer dispositivo no loopback, exclusive-capable y preferentemente no default.
- En la practica puede agarrar interfaz fisica apta, pero la heuristica es por capacidades/estado, no por clase USB pura.

## 4.4 OSC
Flujo:
1. SystemsCheck selecciona osc-nexus.
2. Trinity activateOmniSource('osc-nexus').
3. AudioMatrix activa OSCNexusProvider.

Naturaleza funcional:
- OSCNexusProvider recibe UDP (port 9000) y publica estado (port 9001).
- Soporta modos:
  - pcm: audio real (Float32 en blob)
  - bands / energy-only: datos analiticos
  - control-only: metadatos/controles sin audio

Conclusiones OSC:
- No es solo BPM/phase; puede transportar audio real.
- Pero depende de lo que emita el peer OSC (puede ser solo metadata).

---

## 5) Dilema Canal 2 (Stereo vs Mono)

## 5.1 Virtual Wire
- Estado actual: para loopback fuerza captura a 2 canales.
- Downmix a mono: suma/promedio de todos los canales (L+R)/N.
- Resultado: no esta hardcodeado al canal derecho; tampoco al izquierdo exclusivamente.

## 5.2 USB Direct-Link
- Estado actual: si channels > 1, toma solo el primer canal (indice 0).
- Comentario en codigo indica "take first channel".
- Resultado:
  - Si hardware mono (solo canal 1), funciona.
  - Si señal util entra solo por canal derecho, se pierde informacion.

## 5.3 JACK
- El callback actual registra un puerto mono y reporta channels=1.
- No hay lectura de canal 2 en esta implementacion.

## 5.4 Conclusiones de riesgo
- Riesgo principal real no esta en VW, esta en USBDirectLinkProvider downmix parcial (solo canal 0).
- Para hardware stereo no balanceado por canal, puede haber falsas "ausencias" de audio.

---

## 6) Requisitos de Instalacion por Boton (Windows/macOS)

| Boton | Windows (instalacion limpia) | macOS (instalacion limpia) | Terceros requeridos |
|---|---|---|---|
| MIC | Permiso de microfono del sistema + permiso de navegador/Electron para getUserMedia | Permiso de Microphone (TCC) + permiso app/webview | No |
| VW | Addon nativo cargado + endpoint virtual para loopback util (ej. VB-Cable) + ruteo del sistema hacia ese endpoint | Addon nativo + dispositivo virtual tipo BlackHole/Loopback para routing interno estable | Si, normalmente si |
| USB | Addon nativo + driver class-compliant/ASIO/WASAPI segun interfaz + dispositivo exclusive-capable | Addon nativo + CoreAudio device disponible (hog mode opcional) | Normalmente no, salvo drivers del fabricante |
| OSC | Red local habilitada UDP, puertos 9000 (in) y 9001 (out) no bloqueados | Igual: UDP y firewall permitiendo puertos | No |

Notas:
- SYSTEM (aunque no estaba en los 4 botones pedidos) hoy es la via sin terceros para audio interno en muchos escenarios, usando getDisplayMedia(audio:true).
- VW y USB dependen del modulo nativo; si el addon no carga, la fuente falla por diseno.

---

## 7) Transparencia de Natividad (mensaje para cliente)

Propuesta de wording comercial-tecnico fiel al codigo:

"LuxSync usa un motor nativo de captura de audio (WASAPI/CoreAudio/JACK). Para captura interna por Virtual Wire, el sistema requiere un endpoint virtual de audio disponible (por ejemplo VB-Cable o BlackHole). En equipos sin cable virtual, LuxSync puede capturar audio interno mediante la fuente System (compartir audio del sistema)."

---

## 8) Hallazgos Clave y Recomendaciones

Hallazgos:
1. VW no es driver propietario instalado por LuxSync; es captura nativa sobre endpoints del sistema.
2. MIC usa getUserMedia/getDisplayMedia para rutas legacy-bridge, con filtros browser desactivados.
3. OSC puede ser audio real o solo metadata segun modo de mensaje.
4. USBDirectLink downmix actual usa solo canal 0 en multicanal.

Recomendaciones tecnicas (prioridad alta):
1. Cambiar downmix USBDirectLink de "primer canal" a promedio de canales, alineado con VirtualWire.
2. Exponer en UI diagnostico de dispositivo seleccionado (id, channels, sampleRate real, loopback flag).
3. En onboarding, aclarar explicitamente que VW requiere dispositivo virtual preinstalado para experiencia plug-and-play de audio interno.
4. Añadir test de regresion: señal solo en canal R debe producir energia > 0 en USBDirectLink.

---

## 9) Dictamen Final

- Natividad del motor: VALIDADA (captura low-level real por plataforma).
- Natividad "sin terceros" para VW: NO validada en instalacion limpia.
- Transparencia recomendada al cliente: distinguir claramente SYSTEM (sin cable virtual) vs VW (requiere endpoint virtual dedicado para routing robusto).
