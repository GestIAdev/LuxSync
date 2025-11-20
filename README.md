# 🎸⚡ LuxSync

**Sistema de Sincronización Automática Música-Iluminación DMX**  
*Powered by Selene Song Core V5*

---

## 🎯 ¿Qué es LuxSync?

LuxSync es un sistema de IA que sincroniza automáticamente música e iluminación DMX, eliminando la necesidad de operadores manuales. Usa el motor evolutivo **Selene Song Core V5** (el mismo que DentiaGest) para aprender y mejorar las escenas de luz en tiempo real.

### **Características principales**
- 🎵 **Análisis de audio en tiempo real** (BPM, beats, frecuencias)
- 🧠 **IA evolutiva** (aprende qué escenas funcionan mejor)
- 💡 **Control DMX automático** (USB TORNADO, Art-Net)
- 🎨 **Compatible con FreeStyler** (lee fixtures `.fxt`)
- 🔄 **Reproducible** (same seed → same show)
- 🔥 **Auto-healing** (Phoenix Protocol - sobrevive fallos)
- 📊 **Dashboard web** (visualización 3D + control manual)

---

## 🚀 Quick Start

### **Requisitos**
- Node.js 20+
- Redis 7+
- Interfaz DMX (TORNADO USB o Art-Net)
- Fixtures DMX (PAR LED, moving heads, etc.)

### **Instalación**

```bash
# Clonar repositorio
git clone https://github.com/GestIAdev/LuxSync.git
cd LuxSync

# Instalar dependencias
npm install

# Copiar configuración
cp .env.example .env

# Editar .env con tu configuración
nano .env

# Iniciar Redis (en otra terminal)
redis-server

# Iniciar LuxSync (modo desarrollo)
npm run dev
```

### **Primera ejecución**

```bash
# El sistema debería iniciar y mostrar:
🎸 LuxSync v0.1.0
🔴 Redis: Connected (localhost:6379)
🎵 Audio Engine: Ready
💡 DMX Engine: TORNADO detected (/dev/ttyUSB0)
🧠 Selene Core: Initialized (3 nodes)
📡 GraphQL: http://localhost:4000/graphql
🎭 Dashboard: http://localhost:3000

✅ READY TO ROCK! 🚀
```

---

## 📁 Estructura del Proyecto

```
LuxSync/
├── src/
│   ├── engines/
│   │   ├── audio/          # Audio analysis
│   │   ├── selene/         # Selene AI Core
│   │   ├── dmx/            # DMX control
│   │   └── luxsync/        # Main engine
│   ├── graphql/            # GraphQL API
│   ├── config/             # Configuration
│   └── main.ts             # Entry point
├── dashboard/              # React frontend
├── fixtures/               # Fixture library
├── shows/                  # Recorded shows
└── docs/                   # Documentation
```

---

## 🎛️ Configuración

### **DMX Interface**

#### **TORNADO (USB)**
```env
DMX_INTERFACE=tornado
DMX_PORT=/dev/ttyUSB0    # Linux
DMX_PORT=COM3            # Windows
```

#### **Art-Net (Network)**
```env
DMX_INTERFACE=artnet
DMX_ARTNET_IP=192.168.1.100
DMX_ARTNET_UNIVERSE=0
```

### **Fixtures**

Coloca tus fixtures `.fxt` (FreeStyler) en la carpeta `fixtures/`:

```bash
fixtures/
├── PAR64-RGB.fxt
├── MovingHead-250.fxt
└── Strobe.fxt
```

O crea un symlink a tu carpeta FreeStyler:

```bash
# Linux/Mac
ln -s /path/to/FreeStyler/Fixtures ./fixtures

# Windows (PowerShell admin)
New-Item -ItemType SymbolicLink -Path .\fixtures -Target "C:\FreeStyler\Fixtures"
```

---

## 🎮 Uso

### **Modo Automático**

```bash
# Iniciar con música de fondo
npm start

# LuxSync detectará el audio y generará escenas automáticamente
```

### **Modo Manual (Override)**

Accede al dashboard: `http://localhost:3000`

- 🎨 **Scene Override**: Cambiar escena manualmente
- 🎚️ **Fixture Control**: Controlar fixtures individualmente
- 👍👎 **Feedback**: Evaluar escenas (aprende de tus ratings)

### **Grabar Show**

```bash
# Grabar show actual
curl -X POST http://localhost:4000/graphql \
  -d '{"query":"mutation { startRecording(name: \"MiShow\") }"}'

# Detener grabación
curl -X POST http://localhost:4000/graphql \
  -d '{"query":"mutation { stopRecording }"}'

# El show se guarda en: shows/MiShow.luxshow
```

### **Replay Show**

```bash
# Reproducir show grabado
curl -X POST http://localhost:4000/graphql \
  -d '{"query":"mutation { replayShow(file: \"MiShow.luxshow\") }"}'
```

---

## 🧪 Testing

### **Test Audio Detection**

```bash
npm run test:audio
# Reproduce canción de prueba y valida detección de beats
```

### **Test DMX Output**

```bash
npm run test:dmx
# Envía pattern de prueba a fixtures (rainbow cycle)
```

### **Test Completo**

```bash
npm test
# Ejecuta suite completa de tests
```

---

## 📚 Documentación

- [Master Plan](./docs/LUXSYNC-MASTER-PLAN.md) - Roadmap completo
- [API Reference](./docs/API.md) - GraphQL API
- [Fixtures Guide](./docs/FIXTURES.md) - Cómo añadir fixtures
- [Deployment](./docs/DEPLOYMENT.md) - Deploy en pendrive

---

## 🤝 Contribuir

Contribuciones bienvenidas! Por favor:

1. Fork el repo
2. Crea una branch (`git checkout -b feature/MiFeature`)
3. Commit tus cambios (`git commit -m 'Add MiFeature'`)
4. Push a la branch (`git push origin feature/MiFeature`)
5. Abre un Pull Request

---

## 📄 Licencia

MIT License - Ver [LICENSE](./LICENSE) para más detalles.

---

## 🙏 Agradecimientos

- **Selene Song Core** - Motor de IA evolutiva
- **FreeStyler** - Inspiración y compatibilidad de fixtures
- **Mi casero** - Por darme trabajo y ser buena gente ❤️
- **Mis gatos** - Por esperar pacientemente su caviar 🐱

---

## 📞 Contacto

**Proyecto**: LuxSync  
**Autor**: GestIAdev (Raúl + Copilot + GeminiPunk)  
**Email**: (pendiente)  
**Discord**: (pendiente)  

---

**"De gestionar caries a gestionar luz. Same engine, different canvas."** 🎸⚡

---

*Generado con ❤️ y mucho café por el equipo de GestIAdev*
