# 🏛️ WAVE 140: SYSTEM BLUEPRINT
## El Diseño Arquitectónico Ideal para LuxSync

**Fecha:** 2025-01-XX  
**Propósito:** Establecer la arquitectura objetivo para la Refactorización Modular Completa  
**Documento Hermano:** [VIBE-CONNECTION-AUDIT.md](./VIBE-CONNECTION-AUDIT.md)

---

## 📊 ARQUITECTURA OBJETIVO: FLUJO COMPLETO

```mermaid
flowchart TB
    subgraph INPUT["🎵 CAPA DE ENTRADA"]
        AudioBuffer["Buffer de Audio"]
        Brain["🧠 Brain (Worker)"]
        AudioBuffer --> Brain
    end

    subgraph CONTEXT["🌈 CAPA DE CONTEXTO"]
        VibeManager["VibeManager<br/>(Singleton)"]
        ActiveVibe["ActiveVibe<br/>(ej: techno-club)"]
        Constraints["Constraints Object"]
        
        VibeManager --> ActiveVibe
        ActiveVibe --> Constraints
    end

    subgraph DECISION["💡 CAPA DE DECISIÓN"]
        SeleneLux["SeleneLux<br/>(Orquestador)"]
        ColorEngine["SeleneColorEngine<br/>(Generación Procedimental)"]
        ReactivityModules["Módulos de Reactividad<br/>(Strobe, Flash, Pulse)"]
        
        SeleneLux --> ColorEngine
        SeleneLux --> ReactivityModules
    end

    subgraph OUTPUT["🎨 CAPA DE SALIDA"]
        VisualDecision["visualDecision{}"]
        DMX["DMX Output"]
        
        VisualDecision --> DMX
    end

    Brain -->|"stabilizedAnalysis<br/>+ vibeId"| SeleneLux
    Brain -->|"constrainMetaEmotion()<br/>constrainStrategy()<br/>constrainDimmer()"| VibeManager
    VibeManager -->|"Constraints<br/>(NO colores fijos)"| ColorEngine
    ColorEngine -->|"Color Procedimental<br/>dentro de límites"| SeleneLux
    ReactivityModules -->|"Modificaciones<br/>Reactivas"| SeleneLux
    SeleneLux --> VisualDecision
```

---

## 🎯 PRINCIPIO FUNDAMENTAL: RESTRICCIONES, NO IMPOSICIONES

### El Contrato del VibeManager

```mermaid
flowchart LR
    subgraph WRONG["❌ PATRÓN INCORRECTO (Actual)"]
        Vibe1["Vibe: Techno"]
        HardcodedColor["Color: cyan RGB(0,255,255)"]
        Output1["Output: Siempre cyan"]
        
        Vibe1 --> HardcodedColor --> Output1
    end
    
    subgraph CORRECT["✅ PATRÓN CORRECTO (Objetivo)"]
        Vibe2["Vibe: Techno"]
        Constraints2["Constraints:<br/>Temp: 4000-9000K<br/>Sat: 0.3-0.85"]
        Engine2["ColorEngine<br/>genera dentro<br/>de límites"]
        Output2["Output: Cyan/Magenta/Blanco<br/>según energía musical"]
        
        Vibe2 --> Constraints2 --> Engine2 --> Output2
    end
```

---

## 📐 INTERFAZ DE CONSTRAINTS (YA EXISTE)

```typescript
// De VibeProfile.ts - Esta estructura YA existe y es correcta
interface ColorConstraints {
  temperature: { min: number; max: number };      // Kelvin
  saturation: { min: number; max: number };       // 0-1
  brightness: { min: number; max: number };       // 0-1
  hueRanges?: { start: number; end: number }[];   // Rangos permitidos
  forbiddenHues?: { start: number; end: number }[];  // Rangos prohibidos
}

interface VibeProfile {
  id: string;
  mood: MoodConstraints;
  color: ColorConstraints;
  drop: DropConstraints;
  dimmer: { minIntensity: number; maxIntensity: number };
  // ...más constraints
}
```

---

## 🔄 FLUJO DE DECISIÓN DETALLADO

```mermaid
sequenceDiagram
    participant Audio as 🎵 Audio Buffer
    participant Brain as 🧠 Brain Worker
    participant Vibe as 🌈 VibeManager
    participant Selene as 💡 SeleneLux
    participant Color as 🎨 ColorEngine
    participant DMX as 📡 DMX Output

    Audio->>Brain: Datos de audio raw
    Brain->>Brain: Análisis espectral
    Brain->>Brain: Detección de energía/drops
    
    Brain->>Vibe: constrainMetaEmotion(rawEmotion)
    Vibe-->>Brain: Emoción dentro de límites del vibe
    
    Brain->>Vibe: constrainStrategy(rawStrategy)
    Vibe-->>Brain: Estrategia permitida
    
    Brain->>Selene: stabilizedAnalysis { vibeId, energy, emotion... }
    
    Selene->>Vibe: getActiveConstraints()
    Vibe-->>Selene: ColorConstraints, DimmerConstraints, etc.
    
    Selene->>Color: generateColor(energy, constraints)
    Note over Color: Fibonacci/Quintas/etc<br/>DENTRO de constraints
    Color-->>Selene: { primary, secondary, accent }
    
    Selene->>Selene: Aplicar reactivity modules
    Selene->>Selene: Componer visualDecision
    
    Selene->>DMX: visualDecision final
```

---

## 🔧 REFACTORIZACIÓN PROPUESTA

### Paso 1: Conectar VibeManager a SeleneLux

```typescript
// SeleneLux.ts - CAMBIO REQUERIDO
import { VibeManager } from './context/VibeManager';

class SeleneLux {
  private vibeManager: VibeManager;
  
  constructor() {
    this.vibeManager = VibeManager.getInstance();
  }
  
  async lux(analysis: AnalysisResult): Promise<VisualDecision> {
    // Obtener constraints ANTES de cualquier decisión de color
    const constraints = this.vibeManager.getActiveConstraints();
    
    // Pasar constraints al ColorEngine
    const baseColor = this.colorEngine.generate(analysis, constraints);
    
    // El resto del flujo usa baseColor, no valores hardcoded
    // ...
  }
}
```

### Paso 2: Eliminar Bloques Hardcoded

```mermaid
flowchart TB
    subgraph CURRENT["Estado Actual (Líneas 1598-1876)"]
        Check1["if techno-club"]
        Block1["145 líneas de<br/>colores hardcoded"]
        Check2["if pop-rock"]
        Block2["117 líneas de<br/>colores hardcoded"]
        
        Check1 --> Block1
        Check2 --> Block2
    end
    
    subgraph TARGET["Estado Objetivo"]
        Constraints["constraints = vibeManager.getActiveConstraints()"]
        Engine["color = colorEngine.generate(analysis, constraints)"]
        Result["Resultado siempre respeta<br/>el vibe activo"]
        
        Constraints --> Engine --> Result
    end
    
    CURRENT -.->|"REFACTORIZAR"| TARGET
```

### Paso 3: Unificar Flujo de Color

```mermaid
flowchart LR
    subgraph BEFORE["ANTES: 3 Caminos"]
        Path1["Camino 1: Techno Hardcoded"]
        Path2["Camino 2: Rock Hardcoded"]
        Path3["Camino 3: ColorEngine (ignorado)"]
    end
    
    subgraph AFTER["DESPUÉS: 1 Camino Universal"]
        Universal["ColorEngine<br/>+ Constraints<br/>= Color Correcto"]
    end
    
    Path1 -.-> Universal
    Path2 -.-> Universal
    Path3 --> Universal
```

---

## 📋 CHECKLIST DE REFACTORIZACIÓN

### Fase 1: Conexión (Quick Win)
- [ ] Importar VibeManager en SeleneLux.ts
- [ ] Obtener constraints al inicio de lux()
- [ ] Crear método `vibeManager.getActiveConstraints()`

### Fase 2: Migración de Color
- [ ] Modificar SeleneColorEngine para aceptar constraints
- [ ] Reemplazar bloque Techno (líneas 1598-1742) por llamada al engine
- [ ] Reemplazar bloque Rock (líneas 1759-1876) por llamada al engine
- [ ] Verificar FiestaLatina y ChillLounge

### Fase 3: Limpieza
- [ ] Eliminar magic numbers (22+ constantes dispersas)
- [ ] Centralizar configuración en VibeProfiles
- [ ] Documentar API de constraints

### Fase 4: Validación
- [ ] Test: Cambiar vibe cambia colores
- [ ] Test: ColorEngine nunca genera fuera de constraints
- [ ] Test: Transiciones suaves entre vibes

---

## 🎨 EJEMPLO: TECHNO-CLUB POST-REFACTORIZACIÓN

### Antes (Hardcoded):
```typescript
// 145 líneas de if/else con valores mágicos
if (normalizedEnergy > 0.7) {
  targetHue = 180; // cyan hardcoded
} else if (normalizedEnergy > 0.4) {
  targetHue = 280; // magenta hardcoded
}
```

### Después (Constraint-Driven):
```typescript
// TechnoClubProfile.ts (ya existe, solo hay que usarlo)
const technoConstraints = {
  color: {
    temperature: { min: 4000, max: 9000 },
    saturation: { min: 0.3, max: 0.85 },
    hueRanges: [
      { start: 170, end: 200 },  // cyans
      { start: 270, end: 310 },  // magentas
      { start: 0, end: 30 }      // blancos/cool
    ]
  }
};

// SeleneLux.ts
const color = this.colorEngine.generate(analysis, constraints);
// ColorEngine internamente:
// 1. Calcula hue ideal según energía
// 2. Verifica que esté en hueRanges permitidos
// 3. Ajusta saturación dentro de min/max
// 4. Retorna color SIEMPRE válido para el vibe
```

---

## 🔮 VISIÓN FINAL

```mermaid
graph TB
    subgraph VISION["🌟 LuxSync 2.0 - Arquitectura Modular"]
        UI["UI: Selector de Vibes"]
        Config["Config: VibeProfiles"]
        Manager["VibeManager: Constraints"]
        Engine["ColorEngine: Generación"]
        Selene["SeleneLux: Orquestación"]
        Output["DMX: Salida"]
        
        UI -->|"Cambia Vibe"| Manager
        Config -->|"Define Límites"| Manager
        Manager -->|"Constraints"| Engine
        Engine -->|"Color Válido"| Selene
        Selene -->|"visualDecision"| Output
    end
    
    subgraph BENEFITS["✅ Beneficios"]
        B1["Sin hardcoding"]
        B2["Fácil añadir vibes"]
        B3["Colores siempre coherentes"]
        B4["Configuración centralizada"]
        B5["Testing predecible"]
    end
    
    VISION --> BENEFITS
```

---

## 📝 CONCLUSIÓN

La arquitectura objetivo ya tiene **90% de los componentes construidos**:

| Componente | Estado | Acción Requerida |
|------------|--------|------------------|
| VibeManager | ✅ Funcional | Conectar a SeleneLux |
| VibeProfiles | ✅ Completos | Usar en lugar de hardcode |
| ColorEngine | ✅ Funcional | Pasar constraints |
| SeleneLux | ❌ Bypass | Eliminar bloques hardcoded |
| Worker | ✅ Integrado | Ya usa VibeManager |

### La Refactorización es QUIRÚRGICA, no RECONSTRUCTIVA

No hay que reescribir el sistema. Hay que:
1. **Conectar** lo que está desconectado
2. **Eliminar** lo que está duplicado
3. **Usar** lo que ya existe pero se ignora

---

**Próximo Wave:** Implementación de la conexión VibeManager → SeleneLux

---

*"La mejor arquitectura no es la más compleja, sino la que hace que las cosas correctas sean fáciles y las incorrectas sean difíciles."*
