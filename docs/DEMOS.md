# 🎸⚡ LUXSYNC - GUÍA DE DEMOS

## 🎮 **DEMOS DISPONIBLES**

### 1️⃣ **Demo: Virtual Lights** (Test básico)
```bash
npm run demo:lights
```
- ✅ Prueba el sistema DMX virtual
- 🌈 Rainbow test automático
- 🎨 Secuencia de colores predefinida
- ⏱️ Duración: ~15 segundos

**Qué verás:**
- 4 PAR LEDs virtuales en terminal
- Secuencia: Rojo → Verde → Azul → Colores mixtos → Rainbow → Blackout

---

### 2️⃣ **Demo: Audio → Luces** (Sincronización automática)
```bash
npm run demo:audio
```
- 🎵 Las luces reaccionan a audio simulado (128 BPM)
- 💡 Mapeo de frecuencias:
  - **PAR 1**: Bass (Rojo)
  - **PAR 2**: Mid (Verde)
  - **PAR 3**: Treble (Azul)  
  - **PAR 4**: Beats (Blanco)
- ⏱️ **Loop infinito** - Presiona `Ctrl+C` para detener

**Qué verás:**
- Luces bailando en tiempo real
- Barras de audio (Bass, Mid, Treble, RMS)
- BPM counter (128 beats/min simulados)
- Frame counter

---

### 3️⃣ **Demo: Control Manual** (Interactivo) ⭐ RECOMENDADO
```bash
npm run demo:manual
```
- 🎹 **Controla las luces con el teclado**
- ✅ Perfecto para testing
- 🎮 Modo interactivo
- 😎 **5 FPS** - Velocidad legible y disfrutable (200ms por frame)

**Controles:**
```
[1]     = BASS (Rojo) 🔴
[2]     = MID (Verde) 🟢
[3]     = TREBLE (Azul) 🔵
[SPACE] = BEAT (Flash blanco) ⚪
[R]     = Rainbow test (5 seg) 🌈
[B]     = Blackout (apagar todo) 🌑
[Q]     = Salir 👋
```

**Tips:**
- 🎵 Presiona las teclas para "tocar" las luces como un instrumento
- 🥁 Usa [SPACE] rítmicamente para simular beats
- 😎 Refresh: 5 FPS (200ms) - ¡Ahora SÍ es disfrutable para humanos!
- 🎨 Las luces decaen naturalmente después de cada pulsación

---

## 🎤 **AUDIO REAL (Micrófono)**

Para capturar audio real del micrófono necesitas ejecutar en un navegador con Web Audio API:

**OPCIÓN 1: Electron App** (Próximamente)
```bash
npm run electron
```

**OPCIÓN 2: Navegador** (Próximamente)
```bash
npm run web
```

**OPCIÓN 3: Micrófono USB directo** (Requiere PortAudio)
- Instalar `node-portaudio`
- Configurar en `.env`: `AUDIO_INPUT_DEVICE=<device_id>`

Por ahora, usa **demo:manual** para simular beats con el teclado 🎹

---

## 🔧 **TROUBLESHOOTING**

### ❓ Demo entra en loop infinito
**Respuesta:** ¡Es correcto! Los demos `demo:audio` corren continuamente.  
**Solución:** Presiona `Ctrl+C` para detener.

### ❓ No veo colores en terminal
**Respuesta:** Tu terminal no soporta códigos ANSI.  
**Solución:** Usa **Windows Terminal**, **VS Code Terminal** o **PowerShell 7+**.

### ❓ Demo se ve distorsionado
**Respuesta:** Terminal muy pequeña.  
**Solución:** Maximiza la ventana de terminal (mínimo 80x40 caracteres).

### ❓ Quiero cambiar el BPM simulado
**Respuesta:** Edita `src/engines/audio/AudioSimulator.ts`:
```typescript
constructor(bpm: number = 128) { // <- Cambia 128 por tu BPM deseado
```

---

## 📊 **ESTADO DEL PROYECTO**

```
FASE 1: ✅ COMPLETADA (95%)
├─ Audio Engine: ✅ 100%
├─ Virtual DMX: ✅ 100%  
├─ Visualizador: ✅ 100%
├─ Sincronización: ✅ 100%
└─ TornadoDriver: ⏳ Pendiente (hardware real)

PRÓXIMO:
- Integrar Selene AI (Fase 2)
- Parser fixtures FreeStyler (Fase 3)
```

---

## 🎯 **RECOMENDACIÓN PARA PRUEBAS**

1. Primero: `npm run demo:lights` (15 seg, automático)
2. Luego: `npm run demo:manual` (interactivo, presiona teclas)
3. Finalmente: `npm run demo:audio` (loop infinito, Ctrl+C para salir)

---

## 🚀 **CUANDO TENGAS TORNADO USB**

Solo necesitarás cambiar una línea en el código:
```typescript
// Antes (Virtual)
const dmx = new VirtualDMXDriver();

// Después (Real)
const dmx = new TornadoDriver('/dev/ttyUSB0'); // Linux
const dmx = new TornadoDriver('COM3');         // Windows
```

¡Y listo! Las luces reales bailarán igual que las virtuales 🔥

---

**¿Dudas?** Revisa el código fuente en `src/demo-*.ts` 🎨
