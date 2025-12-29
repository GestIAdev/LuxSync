# 🔬 WAVE 200: LA AUTOPSIA DEL SISTEMA

> **Fecha**: 29 Diciembre 2025  
> **Estado**: Análisis Post-Mortem del Flujo de Datos  
> **Diagnóstico**: Síndrome del "God Object" + Doble Personalidad Cerebro/Físico

---

## 📋 RESUMEN EJECUTIVO

LuxSync 1.x sufre de **esquizofrenia arquitectónica**:
- El Worker (GAMMA/mind.ts) cree que es el cerebro absoluto
- El Main Thread (main.ts) cree que él manda
- SeleneLux está en medio tratando de arbitrar
- El resultado: **flujos de datos cruzados donde nadie sabe quién tiene la autoridad**

---

## 🔍 PARTE 1: RASTREO DEL FLUJO DE DATOS

### El Camino del Dato (Audio → Luz)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           🎵 AUDIO INPUT                                     │
│                    (Sistema/Micrófono via Web Audio)                        │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    📡 RENDERER (Frontend)                                   │
│              AudioProcessor.ts → IPC 'trinity:audio-data'                   │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
         ┌─────────────────────┴─────────────────────┐
         │                                           │
         ▼                                           ▼
┌────────────────────┐                    ┌────────────────────────────────────┐
│    main.ts:430     │                    │      TrinityOrchestrator           │
│  currentAudioData  │                    │   sendToWorker('alpha', audio)     │
│   (COPIA LOCAL)    │                    └───────────────┬────────────────────┘
└────────┬───────────┘                                    │
         │                                                ▼
         │                                    ┌───────────────────────┐
         │                                    │  WORKER ALPHA (senses) │
         │                                    │   Wave8 Analysis       │
         │                                    └───────────┬───────────┘
         │                                                │
         │                                                ▼
         │                                    ┌───────────────────────┐
         │                                    │  WORKER GAMMA (mind)   │
         │                                    │   SeleneColorEngine    │
         │                                    │   Strategy/Mood/Key    │
         │                                    │   genera: palette RGB  │
         │                                    └───────────┬───────────┘
         │                                                │
         │                     ┌──────────────────────────┘
         │                     │
         │                     ▼
         │        ┌─────────────────────────────────────────┐
         │        │           main.ts:343                    │
         │        │  trinity.on('lighting-decision') →       │
         │        │  selene.updateFromTrinity(debug, palette)│
         │        └───────────────────┬─────────────────────┘
         │                            │
         ▼                            ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                         SeleneLux.ts                                        │
│  ┌─────────────────────┐       ┌──────────────────────────────┐            │
│  │  processAudioFrame  │       │     updateFromTrinity        │            │
│  │   (desde main.ts    │  VS   │  (desde Worker via main.ts)  │            │
│  │    startMainLoop)   │       │                              │            │
│  └──────────┬──────────┘       └──────────────┬───────────────┘            │
│             │                                  │                            │
│             │      ¿QUIÉN ESCRIBE lastColors?  │                            │
│             │                                  │                            │
│             ▼                                  ▼                            │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │                    this.lastColors                          │           │
│  │     (ambos métodos intentan escribir aquí)                  │           │
│  └─────────────────────────────────────────────────────────────┘           │
└────────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                         main.ts:830-1400                                    │
│                    🏛️ UNIFIED REACTIVITY PIPELINE                          │
│                                                                            │
│  • Gatekeeper (silence detection)                                          │
│  • Router (context classification)                                          │
│  • Physics (decay, inertia)                                                 │
│  • Zone Logic (PAR_FRONT, MOVING_LEFT, etc.)                               │
│  • Constraints (Vibe presets)                                              │
│  • Clipper (noise floor)                                                   │
│                                                                            │
│  TODO ESTO DEBERÍA ESTAR EN SeleneLux o FixturePhysics!                   │
└──────────────────────────────┬─────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                    UniversalDMXDriver / ArtNetDriver                        │
│                      dmx.setChannelValue(addr, val)                         │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔴 PARTE 2: PUNTOS DE RUPTURA IDENTIFICADOS

### 2.1 El "Teléfono Roto" Principal

```typescript
// main.ts:343 - El Worker manda colores
trinity.on('lighting-decision', (decision) => {
  selene.updateFromTrinity(decision.debugInfo, decision.palette)  // ← Escribe lastColors
})

// main.ts:860 - Pero TAMBIÉN se procesa audio localmente
const state = selene.processAudioFrame({...}, deltaTime)  // ← TAMBIÉN escribe lastColors

// SeleneLux.ts:856 - La "solución" era isWorkerActive()
const workerIsActive = this.isWorkerActive()  // ← WAVE 166: Ahora siempre FALSE

if (workerIsActive && isSeleneMode) {
  // Usar colores del Worker
} else {
  // Generar colores localmente  ← AHORA SIEMPRE ENTRA AQUÍ
}
```

**PROBLEMA**: Al matar el Worker (WAVE 166), el flujo local NO tiene:
- Key musical (no hay Wave8 analysis)
- Mode (major/minor)
- Section detection
- MacroGenre

El Main Thread solo tiene `currentAudioData` (bass/mid/treble crudo).

### 2.2 La Doble Escritura de Estado

| Método | Escribe en | Cuándo |
|--------|-----------|--------|
| `updateFromTrinity()` | `lastColors`, `lastTrinityData` | Cada mensaje del Worker (~30fps) |
| `processAudioFrame()` | `lastColors`, `lastBrainOutput` | Cada frame del mainLoop (~33fps) |

**CONFLICTO**: Ambos escriben a ~30fps. El que llegue último "gana".
Con Worker activo: `updateFromTrinity` domina.
Sin Worker: `processAudioFrame` domina pero NO tiene contexto musical.

### 2.3 main.ts: El Monolito Prohibido

| Líneas | Responsabilidad | Debería Estar En |
|--------|----------------|------------------|
| 1-150 | Window creation, permissions | `WindowManager.ts` |
| 150-300 | Selene initialization, Trinity setup | `SeleneOrchestrator.ts` |
| 300-450 | Event forwarding (trinity → UI) | `EventBridge.ts` |
| 430-550 | Audio state management | `AudioStateManager.ts` |
| 550-800 | IPC handlers (DMX, config) | `IPCHandlers.ts` |
| **800-1500** | **PHYSICS + ZONE LOGIC** | **`FixturePhysicsDriver.ts`** |
| 1500-1800 | Effects engine handling | `EffectsController.ts` |
| 1800-2200 | Manual override system | `OverrideManager.ts` |
| 2200-2800 | More IPC handlers | Split by domain |
| 2800-3290 | Config, fixtures, shows | Domain managers |

**CRÍTICO**: Las líneas 800-1500 contienen:
- Gatekeeper (silence detection)
- Router (context mode)
- Zone switch (PAR_FRONT, MOVING_LEFT, etc.)
- Physics (decay, inertia)
- Vibe constraints
- **TODO el cálculo de intensidad por fixture**

Esto es **LÓGICA DE NEGOCIO** mezclada con **ELECTRON BOILERPLATE**.

---

## 🟠 PARTE 3: RESPONSABILIDADES INDEBIDAS DE main.ts

### 3.1 Lo que main.ts DEBERÍA hacer (Orquestador)

```
✅ Crear ventana Electron
✅ Configurar permisos (audio, display capture)
✅ Inicializar subsistemas (Selene, Trinity, DMX)
✅ Enrutar eventos IPC (frontend ↔ backend)
✅ Ciclo de vida de la app (ready, will-quit, etc.)
```

### 3.2 Lo que main.ts ESTÁ haciendo (God Object)

```
❌ Calculando intensidades por zona (800+ líneas de switch/case)
❌ Aplicando física de decay con buffers propios
❌ Manteniendo estado de audio duplicado (currentAudioData)
❌ Clasificando contexto musical (isMelodyDominant, isRealSilence)
❌ Aplicando Vibe constraints (VIBE_PRESETS dictionary)
❌ Calculando colores de back-pars
❌ Detectando AGC traps
❌ Manejando histéresis de movers
❌ Procesando efectos especiales (strobe, police, rainbow)
❌ Sistema completo de override manual
❌ Conversión HSL↔RGB
❌ Noise floor detection
❌ Y más...
```

### 3.3 Diagnóstico: "Dios Tiene Demasiadas Responsabilidades"

```
┌──────────────────────────────────────────────────────────────────┐
│                        main.ts (3290 líneas)                      │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │   WINDOW    │  │   AUDIO     │  │    DMX      │               │
│  │  CREATION   │  │  PROCESSING │  │  HARDWARE   │               │
│  └─────────────┘  └─────────────┘  └─────────────┘               │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │   PHYSICS   │  │   EFFECTS   │  │   CONFIG    │               │
│  │   ENGINE    │  │   ENGINE    │  │   MANAGER   │               │
│  └─────────────┘  └─────────────┘  └─────────────┘               │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │    IPC      │  │   TRINITY   │  │  OVERRIDES  │               │
│  │  HANDLERS   │  │   BRIDGE    │  │   SYSTEM    │               │
│  └─────────────┘  └─────────────┘  └─────────────┘               │
│                                                                   │
│                    TODO EN UN SOLO ARCHIVO                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔵 PARTE 4: EL CONFLICTO WORKER vs MAIN THREAD

### 4.1 Lo que el Worker (mind.ts) cree que hace

```
"Soy el CEREBRO. Proceso audio con Wave8, detecto key/mode/section,
genero paletas con SeleneColorEngine, y mando decisiones de iluminación.
El Main Thread solo debe ejecutar lo que yo digo."
```

### 4.2 Lo que main.ts cree que hace

```
"Yo tengo el audio crudo. Yo tengo los fixtures. Yo calculo la física.
Yo aplico los Vibe presets. Yo decido qué intensidad tiene cada zona.
El Worker solo me da 'sugerencias' de color."
```

### 4.3 Lo que SeleneLux cree que hace

```
"Yo soy el árbitro. Recibo datos del Worker (updateFromTrinity) y 
del Main Thread (processAudioFrame). Intento mantener lastColors
coherente. Pero cuando el Worker muere... ¿qué hago?"
```

### 4.4 El Resultado: Nadie Manda

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   WORKER    │ ──RGB──▶│  SELENE     │◀──RGB── │  MAIN.TS    │
│   (mind)    │         │   LUX       │         │  mainLoop   │
└─────────────┘         └──────┬──────┘         └─────────────┘
                               │
                               ▼
                        lastColors = ???
                        (depende de quién llegó último)
```

---

## ⚫ PARTE 5: WAVE 166 - EL COLAPSO

### Lo que hicimos

```typescript
// SeleneLux.ts:212 - WAVE 166
private isWorkerActive(): boolean {
  return false;  // 💀 SIEMPRE FALSE
}
```

### Lo que pasó

1. El Worker sigue corriendo y mandando datos ✓
2. `updateFromTrinity()` sigue actualizando `lastTrinityData` ✓
3. **PERO** `processAudioFrame()` ahora ignora los colores del Worker
4. Intenta generar localmente pero...
5. `hasTrinityContext` check: `lastTrinityData.macroGenre !== 'UNKNOWN'`
6. Como el Worker sigue mandando datos, `lastTrinityData` **sí tiene macroGenre**
7. **PERO** el colorInterpolator local no tiene la misma configuración
8. Resultado: **Fallback rojo/blanco** (colores de emergencia)

### La Ironía

Al matar el Worker, descubrimos que **todo el sistema dependía de él**.
El Main Thread nunca fue autónomo - solo era un ejecutor.

---

## 🎯 CONCLUSIONES PARA WAVE 200 BLUEPRINT

### Problemas Fundamentales

1. **God Object**: main.ts hace TODO
2. **Doble Cerebro**: Worker y Main compiten por control
3. **SSOT Inexistente**: `lastColors` tiene múltiples escritores
4. **Coupling Fuerte**: Todo depende de todo
5. **Responsabilidades Mezcladas**: Física con IPC con Audio con DMX

### Lo que Necesitamos

1. **Separación Clara de Capas**
2. **Único Punto de Verdad**
3. **Flujo Unidireccional de Datos**
4. **Módulos Desacoplados**
5. **El Main Thread Orquestra, No Calcula**

---

> **Siguiente Documento**: [WAVE-200-BLUEPRINT.md](./WAVE-200-BLUEPRINT.md)  
> La Nueva Arquitectura Titan
