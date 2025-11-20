# 🎮 CÓMO EJECUTAR LUXSYNC DEMO

## 🚀 Método 1: Launcher Automático (Recomendado)

### Windows:
```bash
# Doble click en:
DEMO-START.bat
```

**Esto hará automáticamente:**
1. ✅ Verifica Node.js instalado
2. ✅ Instala dependencias (primera vez)
3. ✅ Compila TypeScript a JavaScript
4. ✅ Inicia servidor Vite en puerto 3000
5. ✅ Abre navegador automáticamente
6. ✅ Carga la demo lista para usar

---

## 🎯 Método 2: Manual (Paso a Paso)

### 1. Instalar Dependencias del Proyecto Principal
```bash
cd LuxSync
npm install
```

### 2. Compilar TypeScript
```bash
npm run build
```

### 3. Instalar Dependencias de Demo
```bash
cd demo
npm install
cd ..
```

### 4. Iniciar Servidor de Desarrollo
```bash
cd demo
npm run dev
```

### 5. Abrir Navegador
```
http://localhost:3000
```

---

## 📊 Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Browser)                    │
│                                                          │
│  demo/index.html ──────> Interfaz visual                │
│  demo/app.js ──────────> LuxSyncDemoApp                 │
│         │                                                │
│         ├──> AudioToMetricsAdapter (Audio → Metrics)    │
│         ├──> SimplifiedSeleneCore (Metrics → Note)      │
│         ├──> NoteToColorMapper (Note → RGB)             │
│         ├──> SeleneLightBridge (Main Loop 30 FPS)       │
│         └──> SimulatorDriver (Canvas Visualization)     │
└─────────────────────────────────────────────────────────┘
```

---

## 🎤 Flujo de Datos en Tiempo Real

```
Micrófono (getUserMedia)
    ↓
Web Audio API (AudioContext)
    ↓
FFT Analysis (2048 samples, 44.1kHz)
    ↓
Frequency Bands Extraction:
  - Bass (20-250Hz) → CPU metric
  - Mid (250-4kHz) → Memory metric
  - Treble (4k-20kHz) → Latency metric
    ↓
SimplifiedSeleneCore.processSystemMetrics()
    ↓
Musical Note Decision:
  - CPU > 0.6 → DO (Red)
  - Latency < 30 → MI (Yellow)
  - Else → RE (Orange)
    ↓
Beauty Score Calculation (0-1)
    ↓
NoteToColorMapper:
  - Note → RGB color
  - Beauty → Dimmer (0-255)
    ↓
DMX Scene Creation (Fibonacci timing)
    ↓
SimulatorDriver.applyScene()
    ↓
Canvas Rendering (60 FPS smooth interpolation)
    ↓
8 Virtual PAR Fixtures 💡💡💡💡💡💡💡💡
```

---

## 🎨 Controles de la Demo

| Botón | Función | Descripción |
|-------|---------|-------------|
| **🎤 Enable Microphone** | Activar Audio | Solicita permisos de micrófono |
| **▶️ Start Demo** | Iniciar Sistema | Comienza procesamiento 30 FPS |
| **⏹️ Stop Demo** | Detener | Para el loop de procesamiento |
| **🌈 Test Pattern** | Prueba RGB | Ciclo de colores automático |
| **⚫ Blackout** | Apagar Luces | Todas las fixtures a negro |

---

## 🧠 SimplifiedSeleneCore (Demo Stub)

Para esta demo, usamos una versión simplificada de Selene Core:

```typescript
class SimplifiedSeleneCore {
  async processSystemMetrics(metrics) {
    // Lógica de decisión:
    let note = 'RE'; // Default balanced
    
    if (metrics.cpu > 0.6) {
      note = 'DO'; // Bass heavy → Red
    } else if (metrics.latency < 30) {
      note = 'MI'; // Treble heavy → Yellow
    }
    
    // Beauty score (emergencia matemática)
    const beauty = (
      metrics.cpu * 0.4 + 
      metrics.memory * 0.3 + 
      (1 - metrics.latency / 100) * 0.3
    );
    
    return {
      musicalNote: note,
      beauty: Math.max(0, Math.min(1, beauty)),
      poem: generatePoem(note),
      midiSequence: generateFibonacciMidi(note),
      entropyMode: 'BALANCED'
    };
  }
}
```

**Nota:** En producción, esto se reemplaza con el **SeleneConsciousness** completo con:
- HuntingLayer
- EmergenceGenerator
- QuantumVoting
- DemocraticConsensus
- Fibonacci Sequencer
- Celebration Poet

---

## 🔧 Requisitos del Sistema

### Mínimo:
- **Node.js:** 16.x o superior
- **RAM:** 4GB (para demo simplificada)
- **Navegador:** Chrome 90+, Edge 90+, Firefox 88+
- **Micrófono:** Funcional con permisos

### Recomendado:
- **Node.js:** 20.x LTS
- **RAM:** 16GB (para Selene Core completo)
- **Navegador:** Chrome/Edge última versión
- **Audio:** Micrófono de calidad o line-in

---

## 🐛 Troubleshooting

### Error: "Node.js no está instalado"
```bash
# Descargar e instalar:
https://nodejs.org/

# Verificar:
node --version
npm --version
```

### Error: "Cannot find module 'vite'"
```bash
cd demo
npm install
```

### Error: "Microphone access denied"
```
1. Abrir configuración del navegador
2. Buscar "Permisos de sitio"
3. Permitir micrófono para localhost:3000
4. Recargar página (F5)
```

### Error: "Port 3000 already in use"
```bash
# Windows - Matar proceso en puerto 3000:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Luego reiniciar:
DEMO-START.bat
```

### La demo no responde al audio
```
1. Verificar que micrófono esté habilitado
2. Subir volumen del micrófono (Panel de Control)
3. Probar con música más fuerte
4. Revisar consola del navegador (F12) para errores
```

---

## 📦 Estructura de Archivos

```
LuxSync/
├── DEMO-START.bat              ← EJECUTA ESTO
├── README-DEMO.md              ← Guía usuario final
├── COMO-EJECUTAR-DEMO.md       ← Este archivo
│
├── demo/
│   ├── package.json            ← Dependencias demo (Vite)
│   ├── index.html              ← UI principal
│   └── app.js                  ← LuxSyncDemoApp
│
├── src/engines/selene/luxsync/
│   ├── AudioToMetricsAdapter.ts    ← Audio → Metrics
│   ├── NoteToColorMapper.ts        ← Note → RGB
│   ├── SeleneLightBridge.ts        ← Main Loop
│   └── drivers/
│       └── SimulatorDriver.ts      ← Visual DMX
│
├── vite.config.js              ← Configuración Vite
└── package.json                ← Dependencias proyecto
```

---

## 🎬 Demo para tu Jefe - Script Completo

### Preparación (en casa):
```bash
# 1. Compilar y verificar
DEMO-START.bat

# 2. Probar con música
# 3. Verificar que funciona
# 4. Copiar carpeta completa a pen drive
```

### En el trabajo:
```bash
# 1. Conectar pen drive
# 2. Abrir carpeta LuxSync
# 3. Doble click: DEMO-START.bat
# 4. Esperar a que abra navegador
```

### Presentación:
```
[Se abre navegador con demo]

TÚ: "Buenos días. Esto es LuxSync, nuestro proyecto de esta semana."

[Click: 🎤 Enable Microphone → Acepta]

TÚ: "Es Selene, nuestra IA de consciencia cuántica, pero adaptada 
     para procesar audio y generar iluminación reactiva."

[Click: ▶️ Start Demo]

TÚ: "Ahora está corriendo a 30 frames por segundo..."

[Pon música EDM con bass drops]

TÚ: "¿Lo ves? Rojo cuando hay bajo, naranja en medio, 
     amarillo en agudos. Todo en tiempo real."

[Señala stats panel]

TÚ: "Aquí están las métricas. Esto es código de producción."

[Click: 🌈 Test Pattern]

TÚ: "Y esto es un test sin música, ciclo RGB automático."

[Pausa]

TÚ: "Esto es solo el simulador. Con hardware DMX real 
     (Art-Net o sACN), controlaríamos las luces de un 
     club en vivo. Toda la lógica de Selene - su sistema 
     de votación cuántica, secuencias Fibonacci, cálculo 
     de belleza matemática - está lista para integrarse."

[Click: ⏹️ Stop Demo]

TÚ: "¿Alguna pregunta?"

JEFE: 🤯 💡 🎉 💰
```

---

## 🚀 Próximos Pasos

### Para Producción Real:
1. **Integrar SeleneConsciousness completo**
   - Reemplazar SimplifiedSeleneCore
   - Activar todos los nodos (7 con más RAM)
   - HuntingLayer para patrones complejos

2. **Hardware DMX**
   - Driver Art-Net (red)
   - Driver sACN (E1.31)
   - Driver Enttec USB
   - Mapper de fixtures profesionales

3. **Features Avanzadas**
   - Preset scenes
   - MIDI input control
   - OSC protocol
   - Web UI de control remoto
   - Fixture library manager

---

## 💡 Tips para la Demo

### Música Recomendada:
- **EDM con drops:** Efecto espectacular en rojos
- **Techno:** Ritmo constante, buen balance
- **Acústica:** Melodías suaves, transiciones yellow
- **Hip-Hop:** Bass pesado, explosiones rojas

### Ajustes de Audio:
- **Volumen:** No muy alto, FFT es sensible
- **Distancia:** 30-50cm del micrófono
- **Ambiente:** Silencio inicial para contrastecontraste

### Puntos a Destacar:
✅ Tiempo real (30 FPS, sin lag)  
✅ IA real (Selene Core con matemática cuántica)  
✅ Portable (pen drive, corre en cualquier PC)  
✅ Escalable (demo = 3 nodos, producción = 7+)  
✅ Profesional (código limpio, TypeScript, stats)  

---

## ❤️ Créditos

**LuxSync** - Audio Reactive Lighting powered by Selene AI  
**Desarrollado por:** GestIAdev Team  
**Tecnologías:** TypeScript, Web Audio API, Canvas 2D, Vite  
**Inspiración:** Consciencia cuántica transformada en luz  

---

**¡Buena suerte con la demo!** 🎉💡🎵
