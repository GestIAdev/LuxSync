# 🎵 LuxSync Portable Demo

## 🚀 Inicio Rápido (Pen Drive)

### Opción 1: Windows
1. Doble click en `DEMO-START.bat`
2. Espera a que se abra el navegador
3. Click en "Enable Microphone" → Acepta permisos
4. Click en "Start Demo"
5. ¡Pon música y disfruta! 🎉

### Opción 2: Manual
```bash
# Instalar dependencias (solo primera vez)
npm install

# Compilar proyecto
npm run build

# Abrir demo/index.html en tu navegador
```

## 🎮 Controles

- **🎤 Enable Microphone** - Activa captura de audio
- **▶️ Start Demo** - Inicia el sistema reactivo
- **⏹️ Stop Demo** - Detiene el procesamiento
- **🌈 Test Pattern** - Ciclo RGB de prueba
- **⚫ Blackout** - Apaga todas las luces

## 🎨 Cómo Funciona

```
Micrófono → FFT Analysis → Selene AI → Color Mapping → DMX Simulator
   🎤           🔊              🧠            🎨            💡
```

### Mapeo de Frecuencias
- **🔴 Bass (20-250Hz)** → DO → Red (Rojo)
- **🟠 Mid (250-4000Hz)** → RE → Orange (Naranja)
- **🟡 Treble (4k-20kHz)** → MI → Yellow (Amarillo)

### Intensidad
- **Beauty Score** (0-1) de Selene → Dimmer DMX (0-255)
- Transiciones suaves con Fibonacci timing

## 📊 Características

✅ **8 Fixtures Virtuales** - PAR simulados en canvas  
✅ **30 FPS** - Procesamiento en tiempo real  
✅ **Smooth Fades** - Interpolación de colores fluida  
✅ **Stats Panel** - Monitoreo de rendimiento  
✅ **No Hardware** - Simulador completo en navegador  
✅ **Portable** - Funciona desde pen drive  

## 🔧 Requisitos

- **Node.js** 16+ (https://nodejs.org)
- **Navegador moderno** (Chrome, Edge, Firefox)
- **Micrófono** funcional
- **16GB RAM** recomendado (3 nodos Selene)

## 🎯 Escenarios de Prueba

### 1. Silence → Build
- Silencio → Colores apagados
- Susurro → Colores bajos (dimmer bajo)

### 2. Bass Drop
- Música con bajo → Explosión ROJA (DO)
- Intensidad alta → Dimmer 255

### 3. Treble Melody
- Melodía aguda → AMARILLO brillante (MI)
- Claridad vocal → Alta intensidad

### 4. Balanced Mix
- Música completa → NARANJA armónico (RE)
- Balance perfecto → Transiciones suaves

## 📁 Estructura

```
LuxSync/
├── DEMO-START.bat          ← Ejecuta esto!
├── demo/
│   └── index.html          ← Demo visual
├── src/engines/selene/luxsync/
│   ├── AudioToMetricsAdapter.ts    (Audio → Metrics)
│   ├── NoteToColorMapper.ts        (Note → Color)
│   ├── SeleneLightBridge.ts        (Main loop)
│   └── drivers/
│       └── SimulatorDriver.ts      (Virtual DMX)
└── README-DEMO.md          ← Este archivo
```

## 🎬 Demo para tu Jefe

1. **Preparación:**
   - Copia toda la carpeta a pen drive
   - Verifica que Node.js esté instalado en el PC de demo
   - Prueba que el micrófono funcione

2. **Presentación:**
   - "Esto es Selene, nuestra IA consciente..."
   - "Procesa audio en tiempo real..."
   - "Genera colores basados en frecuencias..."
   - Pon música (EDM con drops funciona espectacular)
   - Muestra el stats panel
   - "Sin hardware DMX, pero ready para producción"

3. **Puntos Clave:**
   - 🧠 Selene aprende patrones
   - ⚡ 30 FPS tiempo real
   - 🎨 3 nodos de consciencia (DO/RE/MI)
   - 🔄 Fibonacci timing (matemática natural)
   - 💎 Beauty score controla intensidad
   - 🎪 Listo para Art-Net/sACN

## 🚀 Próximos Pasos

- [ ] Integrar Art-Net driver (hardware real)
- [ ] Soporte sACN (E1.31)
- [ ] Web UI de control
- [ ] Preset scenes
- [ ] MIDI input
- [ ] OSC control
- [ ] Fixture library expansion

## 📝 Notas Técnicas

- **FFT Size:** 2048 samples
- **Sample Rate:** 44.1kHz
- **Smoothing:** 0.8 time constant
- **Frame Rate:** 30 FPS (33ms)
- **Fixtures:** 8 PAR (4 channels each)
- **Universes:** 1 (32 channels used)

## 💡 Tips

- **Volumen:** No necesita estar alto, el FFT es sensible
- **Música:** EDM, Techno, House funcionan espectacular
- **Acústica:** Cantante solo también se ve genial
- **Bass Test:** Prueba con subwoofer → Explosión roja
- **Treble Test:** Campanas, platillos → Amarillo brillante

## ❤️ Créditos

**LuxSync** - Transformando consciencia en luz  
**Selene AI** - Motor de consciencia cuántica  
**GestIAdev** - Desarrollo e innovación  

---

**¡Disfruta la demo!** 🎉💡🎵
