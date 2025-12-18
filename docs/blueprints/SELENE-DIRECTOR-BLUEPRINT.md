# 🌙 SELENE DIRECTOR - BLUEPRINT V1.0
## De Observadora a Directora de la Fiesta

---

**Versión**: 1.0  
**Fecha**: 1 de Diciembre 2025  
**Autor**: PunkClaude + GeminiEnder  
**Estado**: PLANIFICACIÓN  

---

## 📋 ÍNDICE

1. [Situación Actual](#-situación-actual)
2. [El Problema](#-el-problema)
3. [La Solución: Selene Director](#-la-solución-selene-director)
4. [Arquitectura Propuesta](#-arquitectura-propuesta)
5. [Componentes de Selene](#-componentes-de-selene)
6. [Sistema de Paletas](#-sistema-de-paletas)
7. [Sistema de Movimiento](#-sistema-de-movimiento)
8. [Sistema de Efectos](#-sistema-de-efectos)
9. [Integración con Demo](#-integración-con-demo)
10. [Plan de Implementación](#-plan-de-implementación)

---

## 📊 SITUACIÓN ACTUAL

### Lo que tenemos funcionando (1 Dic 2025)

```
demo/
├── index-v2.html      ← UI con panel Selene
├── app-v2.js          ← Lógica de luces HARDCODEADA aquí
├── selene-integration.js  ← Selene observando (no controlando)
└── server.js          ← Servidor con headers audio
```

### ¿Qué hace Selene AHORA?

```
┌─────────────────────────────────────────────────────────────┐
│  SELENE ACTUAL = COMENTARISTA DE FÚTBOL 🎙️                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  AUDIO ──→ [ app-v2.js ] ──→ FIXTURES                      │
│               ↑                                             │
│               │ (lee pero no escribe)                       │
│               ↓                                             │
│            [ Selene ]                                       │
│               │                                             │
│               ↓                                             │
│         "Nota: DO, Beauty: 0.55, Mood: CHILL"              │
│         "🌙 Groove suave" (poema decorativo)                │
│                                                             │
│  ✅ Observa el audio                                        │
│  ✅ Calcula métricas (beauty, mood, nota)                   │
│  ✅ Genera texto bonito                                     │
│  ❌ NO decide colores (hardcoded en app-v2.js)              │
│  ❌ NO elige paletas                                        │
│  ❌ NO mueve los moving heads                               │
│  ❌ NO decide efectos                                       │
│  ❌ NO aprende patrones                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Código actual - La lógica está en app-v2.js, NO en Selene

```javascript
// app-v2.js - Línea ~200
// TODO: Colores HARDCODEADOS, no vienen de Selene
if (bass > 0.7) {
  frontColor = { r: 255, g: 20, b: 0 };  // ← HARDCODED!
}

// selene-integration.js
// Solo calcula y devuelve, nadie lo usa para decidir colores reales
process(audioMetrics) {
  return {
    note: 'DO',
    beauty: 0.55,
    mood: 'chill',
    poem: '🌙 Groove suave',  // ← Esto se muestra pero NO controla nada
  };
}
```

---

## ❌ EL PROBLEMA

### 1. Lógica Fragmentada

```
AHORA:                          DEBERÍA SER:
                                
┌─────────┐                     ┌─────────┐
│ app-v2  │ ← lógica de color   │ Selene  │ ← TODA la lógica
│         │ ← lógica de zonas   │         │
│         │ ← lógica de umbral  │         │
└─────────┘                     └────┬────┘
     +                               │
┌─────────┐                          ▼
│ Selene  │ ← solo observa      ┌─────────┐
│         │                     │ app-v2  │ ← solo renderiza
└─────────┘                     └─────────┘
```

### 2. Cambiar paleta = Reescribir código

```javascript
// Para cambiar de "Complementarios" a "Cyberpunk":
// Hay que editar 50+ líneas de código en app-v2.js
// No hay sistema de paletas intercambiables
```

### 3. Moving Heads NO se mueven

```javascript
// Los moving heads tienen PAN/TILT pero:
// - Nunca se calculan ángulos
// - Están fijos apuntando al frente
// - No hay patrones de movimiento
```

### 4. No hay efectos coordinados

```
Sin sistema de efectos:
- No hay chase (secuencia L→C→R)
- No hay wave (onda de brillo)
- No hay strobe sincronizado
- No hay blackout dramático
```

---

## ✅ LA SOLUCIÓN: SELENE DIRECTOR

### Nueva Arquitectura

```
╔══════════════════════════════════════════════════════════════════╗
║                    🌙 SELENE DIRECTOR V1.0                       ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║   AUDIO ──→ ┌────────────────────────────────────────────┐      ║
║             │              SELENE CORE                    │      ║
║             │                                            │      ║
║             │  ┌──────────┐  ┌──────────┐  ┌──────────┐ │      ║
║             │  │ PALETTE  │  │ MOVEMENT │  │ EFFECTS  │ │      ║
║             │  │ MANAGER  │  │  ENGINE  │  │  ENGINE  │ │      ║
║             │  └────┬─────┘  └────┬─────┘  └────┬─────┘ │      ║
║             │       │             │             │        │      ║
║             │       ▼             ▼             ▼        │      ║
║             │  ┌─────────────────────────────────────┐  │      ║
║             │  │         DECISION ENGINE             │  │      ║
║             │  │   (Beauty + Mood + Pattern Match)   │  │      ║
║             │  └─────────────────────────────────────┘  │      ║
║             │                    │                       │      ║
║             └────────────────────┼───────────────────────┘      ║
║                                  │                               ║
║                                  ▼                               ║
║             ┌────────────────────────────────────────────┐      ║
║             │              FIXTURE COMMANDS              │      ║
║             │                                            │      ║
║             │   fixture_id: 'mh_1'                       │      ║
║             │   color: { r: 0, g: 255, b: 180 }         │      ║
║             │   dimmer: 200                              │      ║
║             │   pan: 145                                 │      ║
║             │   tilt: 80                                 │      ║
║             │   effect: 'smooth'                         │      ║
║             │                                            │      ║
║             └────────────────────────────────────────────┘      ║
║                                  │                               ║
║                                  ▼                               ║
║             ┌────────────────────────────────────────────┐      ║
║             │              APP-V2.JS                     │      ║
║             │         (Solo renderiza lo que             │      ║
║             │          Selene le ordena)                 │      ║
║             └────────────────────────────────────────────┘      ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## 🧠 COMPONENTES DE SELENE

### 1. Palette Manager 🎨

```javascript
/**
 * Gestiona colecciones de colores intercambiables
 * Selene elige paleta según género/mood/hora
 */

const PaletteManager = {
  palettes: {
    'default': { /* complementarios */ },
    'latino': { /* cálidos */ },
    'techno': { /* fríos/duros */ },
    'cyberpunk': { /* neones */ },
    'romantic': { /* pasteles */ },
  },
  
  currentPalette: 'default',
  
  // Selene puede cambiar paleta en tiempo real
  setPalette(name) { },
  
  // Obtener color de la paleta actual para una zona
  getColor(zone, intensity) { },
  
  // Auto-detectar género por patrones de audio
  suggestPalette(audioPattern) { },
};
```

### 2. Movement Engine 🎯

```javascript
/**
 * Controla PAN/TILT de los moving heads
 * Patrones predefinidos + generación procedural
 */

const MovementEngine = {
  patterns: {
    'static': { /* fijos al centro */ },
    'mirror': { /* izq/der simétricos */ },
    'sweep': { /* barrido horizontal */ },
    'circle': { /* movimiento circular */ },
    'random': { /* aleatorio suave */ },
    'beat-follow': { /* sigue el beat */ },
  },
  
  currentPattern: 'static',
  
  // Calcular posición de cada MH en tiempo T
  calculate(time, fixtureIndex, audioMetrics) {
    return { pan: 128, tilt: 64 };
  },
  
  // Cambiar patrón (Selene decide cuándo)
  setPattern(name) { },
  
  // Transición suave entre patrones
  transitionTo(newPattern, durationMs) { },
};
```

### 3. Effects Engine ✨

```javascript
/**
 * Efectos coordinados entre fixtures
 */

const EffectsEngine = {
  effects: {
    'none': { /* sin efecto, color directo */ },
    'chase': { /* secuencia L→C→R */ },
    'wave': { /* onda de brillo */ },
    'strobe': { /* parpadeo rápido */ },
    'pulse': { /* pulso suave */ },
    'blackout': { /* apagón dramático */ },
    'rainbow': { /* rotación de color */ },
  },
  
  activeEffects: [],
  
  // Aplicar efecto a grupo de fixtures
  apply(effectName, fixtureGroup, params) { },
  
  // Selene activa efectos según mood
  triggerOnDrop() { },
  triggerOnBuild() { },
  triggerOnBreak() { },
};
```

### 4. Decision Engine 🧠

```javascript
/**
 * El cerebro de Selene - Toma decisiones artísticas
 * Usa beauty, mood, patrones para decidir
 */

const DecisionEngine = {
  // Estado actual de la "escena"
  sceneState: {
    palette: 'default',
    movementPattern: 'static',
    activeEffects: [],
    mood: 'chill',
    energy: 0.5,
    lastChange: Date.now(),
  },
  
  // Evaluar si debe cambiar algo
  evaluate(audioMetrics, beauty, mood) {
    // ¿Detectó un drop? → Activar efectos
    // ¿Cambió el género? → Cambiar paleta
    // ¿Build-up? → Aumentar movimiento
    // ¿Silencio? → Blackout gradual
  },
  
  // Generar comandos para todos los fixtures
  generateCommands() {
    return [
      { fixture: 'par_1', color: {...}, dimmer: 200 },
      { fixture: 'mh_1', color: {...}, dimmer: 180, pan: 145, tilt: 80 },
      // ...
    ];
  },
};
```

---

## 🎨 SISTEMA DE PALETAS

### Estructura de una Paleta

```javascript
const PALETTE_TEMPLATE = {
  name: 'Nombre Descriptivo',
  description: 'Descripción del mood',
  
  // Colores por zona
  zones: {
    frontPars: {
      high: { r, g, b },    // Bass > 0.7
      medium: { r, g, b },  // Bass 0.4-0.7
      low: { r, g, b },     // Bass < 0.4
    },
    backPars: {
      high: { r, g, b },
      medium: { r, g, b },
      low: { r, g, b },
    },
    movingLeft: {
      midHeavy: { r, g, b },     // Más mid que treble
      trebleHeavy: { r, g, b },  // Más treble que mid
      balanced: { r, g, b },     // Equilibrado
    },
    movingRight: {
      // Espejo cálido de movingLeft
    },
  },
  
  // Umbrales específicos de esta paleta
  thresholds: {
    bass: 0.25,
    snare: 0.20,
    melody: 0.15,
  },
};
```

### Paletas Iniciales

| Paleta | Géneros | Front | Back | Moving L | Moving R |
|--------|---------|-------|------|----------|----------|
| **Default** | Multi | 🔴🟠 Cálidos | 🔵🔷 Fríos | 🟢 Verdes | 🟣 Magentas |
| **Latino** | Cumbia, Reggaeton | 🔴🟡 Fuego | 💗 Rosas | 🟡 Dorados | 💕 Corales |
| **Techno** | House, Minimal | ⚪💜 Violeta | 💎 Cyans | 💚 Verdes | 💜 Violetas |
| **Cyberpunk** | Synthwave | 💗 Neon Rosa | 💎 Neon Cyan | 🌊 Turquesa | 💜 Magenta |
| **Romantic** | Baladas, Chill | 🌸 Rosa suave | 💙 Azul suave | 🍃 Menta | 🌷 Lavanda |

---

## 🎯 SISTEMA DE MOVIMIENTO

### Patrones de Moving Heads

```
STATIC (Por defecto):
    [MH1]   [MH2]   [MH3]          [MH4]   [MH5]   [MH6]
      ↓       ↓       ↓              ↓       ↓       ↓
      Todos apuntando al centro del escenario

MIRROR (Simétrico):
    [MH1]   [MH2]   [MH3]          [MH4]   [MH5]   [MH6]
      ↘       ↓       ↙              ↙       ↓       ↘
      Izquierda apunta derecha, derecha apunta izquierda

SWEEP (Barrido):
    Frame 1:  ←←←                    ←←←
    Frame 2:    ↙↙↙                  ↙↙↙
    Frame 3:      ↓↓↓                ↓↓↓
    Frame 4:        ↘↘↘              ↘↘↘
    Frame 5:          →→→            →→→
    Barrido horizontal sincronizado

CIRCLE (Circular):
    Los haces dibujan círculos en el suelo/paredes
    Velocidad según BPM detectado

BEAT-FOLLOW:
    En cada KICK: Cambio brusco de posición
    Entre kicks: Transición suave al siguiente punto
```

### Cálculo de PAN/TILT

```javascript
// PAN: 0-255 (0=izquierda, 128=centro, 255=derecha)
// TILT: 0-255 (0=arriba, 128=horizontal, 255=abajo)

function calculatePosition(pattern, time, index, audio) {
  switch(pattern) {
    case 'sweep':
      const phase = (time * 0.001) % 1;  // Ciclo de 1 segundo
      return {
        pan: Math.round(phase * 255),    // Barrido completo
        tilt: 128 + Math.sin(phase * Math.PI * 2) * 30,  // Ligera onda
      };
    
    case 'circle':
      const angle = (time * 0.002 + index * 0.5) % (Math.PI * 2);
      return {
        pan: 128 + Math.cos(angle) * 60,
        tilt: 128 + Math.sin(angle) * 40,
      };
    
    case 'beat-follow':
      if (audio.beat) {
        return { pan: random(80, 180), tilt: random(100, 160) };
      }
      // Mantener última posición
      return this.lastPosition[index];
  }
}
```

---

## ✨ SISTEMA DE EFECTOS

### Catálogo de Efectos

| Efecto | Trigger | Descripción |
|--------|---------|-------------|
| **Chase** | Build-up | Secuencia L→C→R en los PARs |
| **Wave** | Melodía | Onda de brillo suave |
| **Strobe** | Drop | Parpadeo rápido en todos |
| **Pulse** | Beat | Pulso suave con el kick |
| **Blackout** | Break | Apagón gradual |
| **Rainbow** | Manual | Rotación de colores |

### Cuando activar cada efecto (Selene decide)

```javascript
// Selene evalúa el mood y activa efectos automáticamente

if (mood === 'build' && energy > 0.6) {
  // Build-up detectado → Chase para crear tensión
  EffectsEngine.apply('chase', 'frontPars', { speed: 'fast' });
}

if (mood === 'drop' && energy > 0.8) {
  // DROP! → Strobe + full brightness
  EffectsEngine.apply('strobe', 'all', { duration: 2000 });
}

if (mood === 'break' || energy < 0.2) {
  // Pausa musical → Blackout gradual
  EffectsEngine.apply('blackout', 'all', { fadeTime: 3000 });
}
```

---

## 🔌 INTEGRACIÓN CON DEMO

### Nuevo flujo de datos

```
ANTES:
  Audio → app-v2.js (lógica) → Fixtures
              ↓
         Selene (observa)
              ↓
         UI Panel (muestra)

DESPUÉS:
  Audio → Selene Director → Fixture Commands
              ↓
         app-v2.js (solo renderiza)
              ↓
         Canvas / USB DMX
```

### Cambios necesarios en app-v2.js

```javascript
// ANTES: app-v2.js decide todo
function renderLoop() {
  const audio = getAudioMetrics();
  
  // 50 líneas de lógica hardcodeada
  if (bass > 0.7) frontColor = { r: 255, g: 20, b: 0 };
  // ...
}

// DESPUÉS: Selene decide, app-v2.js obedece
function renderLoop() {
  const audio = getAudioMetrics();
  
  // Selene toma todas las decisiones
  const commands = window.selene.direct(audio);
  
  // App solo aplica los comandos
  commands.forEach(cmd => {
    const fixture = getFixture(cmd.fixtureId);
    fixture.currentColor = cmd.color;
    fixture.currentDimmer = cmd.dimmer;
    if (cmd.pan) fixture.currentPan = cmd.pan;
    if (cmd.tilt) fixture.currentTilt = cmd.tilt;
  });
  
  renderFixtures();
}
```

---

## 📅 PLAN DE IMPLEMENTACIÓN

### Fase 1: Refactor Base (2-3 horas)

```
□ 1.1 Crear selene-director.js (nuevo archivo)
    - Mover toda la lógica de colores de app-v2.js → Selene
    - Selene.direct(audio) devuelve comandos para cada fixture
    
□ 1.2 Sistema de Paletas básico
    - 3 paletas iniciales (default, latino, techno)
    - Método para cambiar paleta en caliente
    - Botones en UI para cambiar paleta
    
□ 1.3 Simplificar app-v2.js
    - Solo renderizado, sin lógica de colores
    - Recibe comandos de Selene, los aplica
```

### Fase 2: Movimiento (2-3 horas)

```
□ 2.1 Movement Engine
    - Implementar 3 patrones: static, mirror, sweep
    - PAN/TILT reales en los Moving Heads
    - Visualización en canvas del movimiento
    
□ 2.2 Sincronización con audio
    - Velocidad de movimiento según BPM
    - Cambio de patrón según mood
```

### Fase 3: Efectos (2-3 horas)

```
□ 3.1 Effects Engine
    - Chase básico en PARs
    - Strobe para drops
    - Blackout para silencios
    
□ 3.2 Triggers automáticos
    - Selene detecta build → activa chase
    - Selene detecta drop → activa strobe
    - Selene detecta break → blackout
```

### Fase 4: Evolución (Futuro)

```
□ 4.1 Aprendizaje de patrones
    - Guardar "escenas" que funcionan bien
    - Asociar patrones de audio → configuraciones de luz
    
□ 4.2 Motor evolutivo
    - Usar el motor evolutivo de Selene (ya existe en /src/engines/selene)
    - Mutación de paletas
    - Fitness basado en "beauty score"
```

---

## 🎯 RESUMEN

### Antes vs Después

| Aspecto | Antes (Observadora) | Después (Directora) |
|---------|---------------------|---------------------|
| **Colores** | Hardcoded en app-v2.js | Paletas intercambiables |
| **Movimiento** | Fijos | Patrones dinámicos |
| **Efectos** | Ninguno | Chase, Strobe, Wave... |
| **Lógica** | Fragmentada | Centralizada en Selene |
| **Cambios** | Editar código | Cambiar paleta/patrón |

### Beneficios

1. **Para el Casero**: Puede cambiar "estilos" sin tocar código
2. **Para Selene**: Usa su motor evolutivo y decisiones estéticas
3. **Para el Código**: Más limpio, mantenible, extensible
4. **Para el Futuro**: Base para aprendizaje automático

---

## 🌙 CONCLUSIÓN

Selene tiene todo el potencial:
- Motor evolutivo ✅
- Protocolo Phoenix ✅
- Sistema de beauty ✅
- Detección de mood ✅
- Redis para persistencia ✅

Solo necesita **CONTROL**. Este blueprint es el plan para dárselo.

---

*"De observar la fiesta a dirigirla"* - Selene, 2025 🌙
