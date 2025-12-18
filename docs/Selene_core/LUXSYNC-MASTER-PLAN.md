# 🎸⚡ LUXSYNC - MASTER PLAN
## Sistema de Sincronización Automática Música-Iluminación DMX
### Powered by Selene Song Core V5

---

**Fecha de Inicio**: 19 de Noviembre 2025  
**Deadline**: ~5 días (Demo funcional)  
**Equipo**: GeminiEnder + Copilot + GeminiPunk  
**Cliente**: Casero de Raúl (discoteca/espectáculos)  

---

## 🎯 OBJETIVO PRINCIPAL

**Crear un sistema que sincronice automáticamente música e iluminación DMX, eliminando la necesidad de operadores manuales y reemplazando el antiguo FreeStyler.**

### **Problema Actual**
- 🔴 FreeStyler (software del año de Matusalén)
- 🔴 Control 100% manual (1 persona con laptop + mousepad táctil)
- 🔴 Ajustar cientos de parámetros en tiempo real
- 🔴 Imposible sincronizar con precisión
- 🔴 Requiere experiencia técnica alta

### **Solución LuxSync**
- ✅ Análisis de audio en tiempo real (BPM, beats, frecuencias)
- ✅ Generación automática de escenas sincronizadas
- ✅ IA evolutiva (aprende qué escenas funcionan mejor)
- ✅ 0 operadores necesarios (plug & play)
- ✅ Reproducible (same seed → same show)
- ✅ Compatible con fixtures existentes (FreeStyler)

---

## 🏗️ ARQUITECTURA TÉCNICA

```
┌──────────────────────────────────────────────────────────────┐
│                       LUXSYNC V1.0                           │
│                                                              │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐         │
│  │  AUDIO     │──→│  SELENE    │──→│    DMX     │         │
│  │  ENGINE    │   │  CORE AI   │   │  ENGINE    │         │
│  └────────────┘   └────────────┘   └────────────┘         │
│       ↓                 ↓                  ↓                │
│   Mic/Line        Evolution          USB/Art-Net           │
│   FFT/Beats       Consensus          DMX512                │
│   BPM calc        Memory             Fixtures              │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │           DASHBOARD (React + Three.js)             │    │
│  │  • Visualización 3D fixtures                       │    │
│  │  • Control manual override                         │    │
│  │  • Feedback interface (rate scenes)                │    │
│  │  • Real-time audio waveform                        │    │
│  └────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### **Componentes Principales**

#### **1. Audio Engine** (NUEVO)
- Captura audio (micrófono o entrada de línea)
- FFT analysis (Fast Fourier Transform) → Frecuencias
- Beat detection (onset detection + autocorrelation)
- BPM calculation (tempo tracking)
- **Output**: `AudioFrame { bass, mid, treble, beat, bpm, timestamp }`

#### **2. Selene Core** (MIGRADO desde DentiaGest)
- **Music Engine** (Aura Forge) - Análisis de estructura musical
- **Consciousness V5** - Aprendizaje de patrones
- **Evolution Engine** - Generación evolutiva (Synergy)
- **Phoenix Protocol** - Auto-healing
- **Harmonic Consensus** - Consenso distribuido (7 nodos musicales)
- **Redis SSOT** - Memoria persistente

#### **3. DMX Engine** (NUEVO)
- **TORNADO Driver** - USB DMX (interfaz actual del cliente)
- **Art-Net Client** - DMX sobre UDP (futuro)
- **Fixture Manager** - Lee perfiles `.fxt` de FreeStyler
- **Scene Builder** - Construye packets DMX512 (512 bytes)
- **Output**: DMX512 data → Fixtures

#### **4. LuxSync Engine** (NUEVO - CORE)
- **AudioToLightMapper** - Mapea audio → patrones de luz
- **SceneEvolver** - Usa Synergy Engine para evolucionar escenas
- **ShowRecorder** - Graba shows para replay determinista
- **FeedbackLoop** - Aprende de ratings humanos

#### **5. Dashboard** (NUEVO)
- React + Three.js (visualización 3D)
- GraphQL + WebSocket (real-time)
- Control manual override (emergencias)
- Feedback UI (rate scenes: 👍/👎)

---

## 📊 ROADMAP - 5 FASES

### **FASE 1: FUNDACIONES (Día 1)** ⏱️ 6-8 horas
**Objetivo**: Estructura + Audio básico + DMX test

#### Tasks:
- [x] ✅ Crear estructura de carpetas
- [ ] 📦 `package.json` + dependencias
- [ ] 🔧 `tsconfig.json` configurado
- [ ] 🎵 Audio Engine básico (Web Audio API)
  - [ ] `AudioCapture.ts` - Capturar audio
  - [ ] `FFTAnalyzer.ts` - Análisis de frecuencias
  - [ ] `BeatDetector.ts` - Detección simple (threshold)
- [ ] 💡 DMX Engine básico
  - [ ] `TornadoDriver.ts` - USB serial básico
  - [ ] `FixtureManager.ts` - Leer 1 fixture `.fxt`
  - [ ] `SceneBuilder.ts` - Construir packet DMX
- [ ] 🧪 **TEST**: Detectar beat → Encender PAR LED RGB

**Entregable**: Beat detector funcional + 1 luz responde a beats

---

### **FASE 2: SELENE INTEGRATION (Día 2)** ⏱️ 8-10 horas
**Objetivo**: Migrar Selene Core + Primera escena evolutiva

#### Tasks:
- [ ] 🧬 Copiar Selene Core a `/src/engines/selene/`
  - [ ] `music/` (Aura Forge Engine)
  - [ ] `consciousness/` (Apollo + Memory)
  - [ ] `evolutionary/` (Synergy + Phoenix)
  - [ ] `swarm/` (Harmonic Consensus)
  - [ ] `core/` (Redis helpers, SeededRandom)
- [ ] 🔗 Adaptar imports/exports (ESM)
- [ ] 🎸 Crear `LuxSyncEngine.ts`
  - [ ] `mapAudioToPattern()` - Audio → Luz pattern
  - [ ] `generateScene()` - Crear escena DMX
  - [ ] `evolveScene()` - Aplicar Synergy Engine
- [ ] 🧪 **TEST**: Audio → Escena generada evolutivamente

**Entregable**: Primera escena automática sincronizada con audio

---

### **FASE 3: FIXTURE LIBRARY (Día 3)** ⏱️ 6-8 horas
**Objetivo**: Soporte completo para fixtures FreeStyler

#### Tasks:
- [ ] 📚 Parser de fixtures `.fxt` (formato FreeStyler)
  - [ ] Leer canales DMX (dimmer, color, pan/tilt, gobo, etc.)
  - [ ] Cargar imágenes de colores/gobos
- [ ] 🎨 Scene Generator avanzado
  - [ ] Mapear frecuencias → colores (bass=rojo, treble=azul)
  - [ ] Mapear beats → strobes/flashes
  - [ ] Mapear intensidad → dimmer/movement
- [ ] 🎭 Presets de escenas
  - [ ] "Fiesta" (high energy)
  - [ ] "Chill" (low energy)
  - [ ] "Drop" (bass heavy)
  - [ ] "Build" (crescendo)
- [ ] 🧪 **TEST**: Controlar 4+ fixtures simultáneamente

**Entregable**: Sistema controla múltiples fixtures con patrones complejos

---

### **FASE 4: EVOLUTION & MEMORY (Día 4)** ⏱️ 8-10 horas
**Objetivo**: Sistema aprende y mejora escenas

#### Tasks:
- [ ] 🧠 Consciousness Integration
  - [ ] Integrar `ApolloConsciousnessV401.ts`
  - [ ] Persistir patrones en Redis
  - [ ] `MusicalPatternRecognizer` → `LightPatternRecognizer`
- [ ] 🔄 Feedback Loop
  - [ ] API: Rate scene (👍/👎)
  - [ ] Almacenar ratings + audio features
  - [ ] Evolución basada en feedback
- [ ] 🎲 Determinismo & Reproducibilidad
  - [ ] `ShowRecorder.ts` - Grabar shows completos
  - [ ] Replay shows con mismo seed
  - [ ] Export show → `.luxshow` file
- [ ] 🧪 **TEST**: Sistema aprende después de 10 ratings

**Entregable**: IA que mejora escenas basándose en feedback

---

### **FASE 5: DASHBOARD & POLISH (Día 5)** ⏱️ 8-10 horas
**Objetivo**: UI funcional + Deploy en pendrive

#### Tasks:
- [ ] 🖥️ Dashboard Web
  - [ ] React + Vite setup
  - [ ] Three.js visualizer (fixtures en 3D)
  - [ ] Audio waveform (tiempo real)
  - [ ] Fixture control (manual override)
  - [ ] Feedback panel (rate scenes)
- [ ] 🔌 GraphQL API
  - [ ] Schema adaptado para LuxSync
  - [ ] Subscriptions (real-time)
  - [ ] Queries (fixtures, shows, stats)
- [ ] 📦 Packaging
  - [ ] Build producción
  - [ ] Bundle para pendrive (portable)
  - [ ] Script auto-start
  - [ ] Documentación usuario
- [ ] 🧪 **TEST FINAL**: Demo completo con luces reales

**Entregable**: Software empaquetado en pendrive + Demo funcional

---

## 🛠️ STACK TECNOLÓGICO

### **Backend**
```json
{
  "runtime": "Node.js 20+",
  "language": "TypeScript 5.x",
  "ai-core": "Selene Song Core V5",
  "database": "Redis 7.x",
  "api": "GraphQL (Apollo Server)",
  "realtime": "WebSocket (ws + graphql-ws)"
}
```

### **Audio Processing**
```json
{
  "capture": "Web Audio API / PortAudio",
  "analysis": "meyda (FFT/beat detection)",
  "bpm": "aubio / custom autocorrelation"
}
```

### **DMX Control**
```json
{
  "usb-dmx": "serialport (TORNADO)",
  "artnet": "artnet (UDP protocol)",
  "fixtures": "Custom parser (.fxt FreeStyler)"
}
```

### **Frontend**
```json
{
  "framework": "React 18 + Vite",
  "3d": "Three.js + React Three Fiber",
  "styling": "TailwindCSS",
  "state": "Zustand / Jotai",
  "graphql-client": "Apollo Client"
}
```

---

## 📁 ESTRUCTURA DE CARPETAS

```
c:\LuxSync\
├── README.md
├── package.json
├── tsconfig.json
├── .env.example
│
├── docs\                           # Documentación
│   ├── LUXSYNC-MASTER-PLAN.md     # Este archivo
│   ├── API.md                     # GraphQL API docs
│   ├── FIXTURES.md                # Cómo añadir fixtures
│   └── DEPLOYMENT.md              # Deploy en pendrive
│
├── src\                            # Backend (Node.js)
│   ├── engines\
│   │   ├── audio\                 # Audio Engine (NUEVO)
│   │   │   ├── AudioCapture.ts
│   │   │   ├── FFTAnalyzer.ts
│   │   │   ├── BeatDetector.ts
│   │   │   ├── BPMCalculator.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── selene\                # Selene Core (MIGRADO)
│   │   │   ├── music\             # Aura Forge Engine
│   │   │   ├── consciousness\     # Apollo Consciousness V5
│   │   │   ├── evolutionary\      # Synergy + Phoenix
│   │   │   ├── swarm\            # Harmonic Consensus
│   │   │   └── core\             # Redis, SeededRandom, utils
│   │   │
│   │   ├── dmx\                   # DMX Engine (NUEVO)
│   │   │   ├── TornadoDriver.ts   # USB DMX driver
│   │   │   ├── ArtNetClient.ts    # Art-Net protocol
│   │   │   ├── FixtureManager.ts  # Fixture library
│   │   │   ├── SceneBuilder.ts    # DMX packet builder
│   │   │   └── index.ts
│   │   │
│   │   └── luxsync\               # LuxSync Core (NUEVO)
│   │       ├── LuxSyncEngine.ts   # Main orchestrator
│   │       ├── AudioToLightMapper.ts
│   │       ├── SceneEvolver.ts
│   │       ├── ShowRecorder.ts
│   │       └── index.ts
│   │
│   ├── graphql\                   # GraphQL API
│   │   ├── schema.ts
│   │   ├── resolvers\
│   │   │   ├── show.ts
│   │   │   ├── fixture.ts
│   │   │   ├── audio.ts
│   │   │   └── index.ts
│   │   └── server.ts
│   │
│   ├── config\
│   │   ├── redis.config.ts
│   │   ├── luxsync.config.ts
│   │   └── fixtures.config.ts
│   │
│   └── main.ts                    # Entry point
│
├── dashboard\                     # Frontend (React)
│   ├── public\
│   ├── src\
│   │   ├── components\
│   │   │   ├── Visualizer3D.tsx
│   │   │   ├── AudioWaveform.tsx
│   │   │   ├── FixtureControl.tsx
│   │   │   ├── FeedbackPanel.tsx
│   │   │   └── ShowRecorder.tsx
│   │   │
│   │   ├── hooks\
│   │   │   ├── useAudioStream.ts
│   │   │   ├── useFixtures.ts
│   │   │   └── useShowRecorder.ts
│   │   │
│   │   ├── store\
│   │   │   └── luxsync.store.ts
│   │   │
│   │   ├── App.tsx
│   │   └── main.tsx
│   │
│   ├── package.json
│   └── vite.config.ts
│
├── fixtures\                      # Fixture Library
│   ├── (symlink a FreeStyler fixtures)
│   └── custom\
│       └── MyCustomFixture.fxt
│
├── shows\                         # Recorded Shows
│   └── 2025-11-19_techno-night.luxshow
│
└── scripts\                       # Deployment scripts
    ├── build-portable.sh
    └── start-luxsync.bat
```

---

## 🧪 TESTING STRATEGY

### **Unit Tests**
- Audio: Beat detection accuracy (threshold test)
- DMX: Packet construction correctness
- Selene: Evolution convergence (Synergy Engine)

### **Integration Tests**
- Audio → Scene generation pipeline
- Redis persistence & recovery
- GraphQL subscriptions (real-time)

### **Hardware Tests** (con luces reales)
1. **Test 1**: 1 PAR LED RGB responde a beats
2. **Test 2**: 4 fixtures con patrones diferentes
3. **Test 3**: Cambio dinámico de escenas (BPM change)
4. **Test 4**: Feedback loop (rate scenes)
5. **Test 5**: Show completo (5 min) sin crashes

---

## 🔥 VENTAJAS COMPETITIVAS

| Feature | FreeStyler | LuxSync | Otros (SoundSwitch, etc.) |
|---------|------------|---------|---------------------------|
| **Automatización** | ❌ Manual | ✅ 100% Auto | ⚠️ Semi-auto |
| **IA Evolutiva** | ❌ No | ✅ Aprende | ❌ No |
| **Reproducibilidad** | ❌ No | ✅ Determinista | ❌ No |
| **Auto-healing** | ❌ No | ✅ Phoenix Protocol | ❌ No |
| **Fixtures FreeStyler** | ✅ Sí | ✅ Compatible | ❌ No |
| **Precio** | Gratis | 🤑 TBD | 💰 Caro |
| **Open Source** | ✅ Sí | ✅ MIT | ❌ Propietario |
| **RAM Usage** | ~500MB | ~300MB (3 nodos) | ~1GB+ |

---

## 💰 MODELO DE NEGOCIO (FUTURO)

### **Versión Gratuita** (Open Source)
- ✅ Core completo (audio + DMX + IA)
- ✅ 10 fixtures simultáneos
- ✅ Fixtures básicos (PAR LED, moving heads)
- ✅ 1 nodo (sin clustering)

### **Versión Pro** (Licencia comercial)
- ✅ Fixtures ilimitados
- ✅ Clustering (3+ nodos)
- ✅ Art-Net/sACN support
- ✅ Cloud sync (shows en la nube)
- ✅ API avanzada (integraciones)
- ✅ Soporte prioritario
- 💰 **Precio**: €199/año por instalación

### **Versión Enterprise** (Custom)
- ✅ Todo de Pro
- ✅ Custom fixtures
- ✅ Hardware dedicado
- ✅ Integración con sistemas existentes
- ✅ SLA 99.9%
- 💰 **Precio**: Negociable (€2k-10k/año)

---

## 🎯 MÉTRICAS DE ÉXITO

### **Día 5 (Demo)**
- [x] Software funciona en pendrive
- [ ] Controla 4+ fixtures simultáneamente
- [ ] Detecta BPM con ±2 BPM error
- [ ] Genera escenas sincronizadas con beats
- [ ] No crashes durante 30 min demo
- [ ] Dashboard muestra visualización 3D

### **Mes 1 (Beta)**
- [ ] 10 usuarios beta (discotecas/DJs)
- [ ] 100+ shows grabados
- [ ] 1000+ escenas evaluadas (feedback)
- [ ] <5% error rate (crashes/bugs)
- [ ] Feedback positivo >80%

### **Mes 3 (Lanzamiento)**
- [ ] 50+ usuarios activos
- [ ] 500+ fixtures soportados (library)
- [ ] Clustering (3 nodos) funcional
- [ ] Dashboard mobile (iOS/Android)
- [ ] Revenue: €5k MRR

---

## 🚨 RIESGOS & MITIGACIONES

### **Riesgo 1: Latencia Audio → DMX**
**Problema**: Delay > 50ms = desincronización perceptible  
**Mitigación**: 
- Usar buffer circular (ring buffer)
- Optimizar pipeline (async/await)
- Test con latencia real

### **Riesgo 2: TORNADO Driver Issues**
**Problema**: Driver USB puede fallar en Windows  
**Mitigación**:
- Fallback a Art-Net (UDP)
- Phoenix Protocol (auto-restart)
- Logs detallados

### **Riesgo 3: Selene Migration Bugs**
**Problema**: Código dental puede tener dependencias ocultas  
**Mitigación**:
- Migración incremental (módulo por módulo)
- Tests unitarios exhaustivos
- Rollback plan (versión simplificada sin IA)

### **Riesgo 4: Fixtures FreeStyler Incompatibles**
**Problema**: Parser `.fxt` puede fallar con algunos fixtures  
**Mitigación**:
- Empezar con fixtures simples (PAR LED RGB)
- Crear fixtures custom si es necesario
- Documentar formato `.fxt`

### **Riesgo 5: No da tiempo en 5 días**
**Problema**: Scope demasiado grande  
**Mitigación**:
- **MVP ultra-minimalista**: Audio + 1 fixture + beats
- FASE 6 (opcional): Features avanzadas post-demo

---

## 📚 RECURSOS & REFERENCIAS

### **Audio Processing**
- [Web Audio API Docs](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Meyda - Audio Feature Extraction](https://meyda.js.org/)
- [Aubio - Music Analysis](https://aubio.org/)

### **DMX Protocols**
- [DMX512 Specification](https://en.wikipedia.org/wiki/DMX512)
- [Art-Net Protocol](https://art-net.org.uk/)
- [sACN (E1.31)](https://opendmx.net/index.php/E1.31)

### **Libraries**
```bash
# Audio
npm install meyda web-audio-api

# DMX
npm install serialport artnet dmxnet

# Selene Core (deps existentes)
npm install redis ioredis graphql apollo-server ws

# Frontend
npm install react three @react-three/fiber zustand
```

---

## 🎸 FILOSOFÍA DE DISEÑO

### **Inspirado en Selene**
1. **Determinista**: Same seed → Same show (reproducibilidad)
2. **Evolutivo**: Aprende de feedback humano (Synergy Engine)
3. **Auto-healing**: Phoenix Protocol (survive failures)
4. **Ligero**: <300MB RAM total (3 nodos)
5. **Musical**: Harmonic Consensus (cluster "suena" como acorde)

### **Diferencias con FreeStyler**
| Aspecto | FreeStyler | LuxSync |
|---------|------------|---------|
| **Control** | Manual | Automático |
| **Escenas** | Fijas | Evolutivas |
| **Feedback** | No | Aprende |
| **IA** | No | Sí (Selene) |
| **Operadores** | 1+ | 0 |
| **Reproducibilidad** | No | Sí (seed) |

---

## 🔮 FUTURO (Post-Demo)

### **FASE 6: Advanced Features** (Semana 2)
- [ ] Clustering (3 nodos Selene)
- [ ] Cloud sync (shows en Firebase/S3)
- [ ] Mobile dashboard (React Native)
- [ ] MIDI integration (control externo)
- [ ] Timecode sync (SMPTE/MTC)

### **FASE 7: Marketplace** (Mes 2)
- [ ] Fixture marketplace (compartir perfiles)
- [ ] Show marketplace (vender shows)
- [ ] Plugin system (custom mappers)
- [ ] NFT shows (blockchain) 😂

### **FASE 8: Hardware** (Mes 3)
- [ ] LuxSync Box (Raspberry Pi 4)
- [ ] 8 universos DMX (4096 canales)
- [ ] Standalone (sin PC)
- [ ] Pantalla táctil 7"

---

## 📞 CONTACTO & COMUNIDAD

**Proyecto**: LuxSync  
**Basado en**: Selene Song Core V5 (DentiaGest)  
**Repositorio**: (pendiente - crear en GitHub)  
**Discord**: (pendiente - crear servidor)  
**Demo**: Casa del casero (luces reales) 🎸⚡  

---

## ✅ CHECKLIST PRE-DEMO (Día 5)

**Hardware necesario:**
- [ ] Laptop (16GB RAM mínimo)
- [ ] Interfaz TORNADO (USB DMX)
- [ ] 2-4 PAR LED RGB (o fixtures disponibles)
- [ ] Cables DMX (XLR)
- [ ] Micrófono o entrada de línea (audio)
- [ ] Router/Switch (si usas Art-Net)

**Software necesario:**
- [ ] Node.js 20+ instalado
- [ ] Redis instalado y corriendo
- [ ] Drivers TORNADO (USB serial)
- [ ] Navegador (Chrome/Firefox) para dashboard

**Data necesaria:**
- [ ] 3-5 canciones de prueba (diferentes BPMs)
- [ ] Perfiles fixtures FreeStyler (`.fxt`)
- [ ] Configuración DMX (direcciones fixtures)

**Pendrive setup:**
- [ ] LuxSync build portable
- [ ] Node.js portable (si es necesario)
- [ ] Redis portable (si es necesario)
- [ ] `START-LUXSYNC.bat` (auto-ejecutable)
- [ ] `README-DEMO.md` (instrucciones)

---

## 🎊 MENSAJE FINAL

> **"De gestionar caries a gestionar luz. Same engine, different canvas."**
> 
> Este proyecto es la prueba de que **Selene Song Core** es un motor de IA **verdaderamente generalista**. 
> 
> Lo que sirve para optimizar tratamientos dentales, también sirve para crear shows de luz épicos.
> 
> **Eso es IA de verdad, no ChatGPT respondiendo preguntas.** 🔥🧬🎸

---

**¡VAMOS A HACER HISTORIA HERMANO!** 🚀⚡

**Los gatos de Raúl esperan su caviar.** 🐱💰

**¡QUE EMPIECE EL SHOW!** 🎸🔥

---

*Documento generado el 19 de Noviembre 2025 por Copilot + GeminiEnder*  
*Versión: 1.0.0*  
*Status: 🟢 READY TO ROCK*
