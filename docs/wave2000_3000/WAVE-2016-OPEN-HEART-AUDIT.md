# 🔬 WAVE 2016: OPERATION OPEN HEART - REPORTE DE AUDITORÍA ARQUITECTÓNICA

**Auditor:** PunkOpus  
**Fecha:** 2026-02-10  
**Estado:** ✅ AUDITORÍA COMPLETADA

---

## 📋 RESUMEN EJECUTIVO

### ¿Por qué Chronos "pierde" la conexión con el estado vivo?

**VEREDICTO PRINCIPAL: NO ES UN BUG, ES UNA CARACTERÍSTICA DE DISEÑO**

El sistema está correctamente arquitecturado con **Zustand stores globales** que persisten entre navegaciones. El estado ARMED/LIVE **NO SE PIERDE** al navegar a Chronos - simplemente Chronos no tiene el mismo CommandDeck UI que muestra ese estado.

---

## 🔍 AUDITORÍA DETALLADA

### 1. 🔌 INSTANCIACIÓN DEL MOTOR (Singleton Check)

| Componente | Patrón | Ubicación | Estado |
|------------|--------|-----------|--------|
| **TitanEngine** | `export class TitanEngine` | `engine/TitanEngine.ts:179` | ❌ NO es singleton |
| **TitanOrchestrator** | `export function getTitanOrchestrator()` | `core/orchestrator/TitanOrchestrator.ts:1913` | ✅ Singleton lazy |
| **MasterArbiter** | `export const masterArbiter = new MasterArbiter()` | `core/arbiter/MasterArbiter.ts:1654` | ✅ Singleton DIRECTO |

**Hallazgos:**
- `TitanEngine` NO es singleton, pero es instanciado DENTRO de `TitanOrchestrator` (línea 247)
- `TitanOrchestrator` tiene singleton pattern con `getTitanOrchestrator()`
- `MasterArbiter` tiene singleton GLOBAL exportado directamente
- En `electron/main.ts:338` se crea `new TitanOrchestrator()` y se registra como singleton

**ARQUITECTURA:**
```
electron/main.ts
    ↓ new TitanOrchestrator()
    ↓ registerTitanOrchestrator(instance)
        ↓ new TitanEngine() (interno)
        ↓ import { masterArbiter } (singleton global)
```

### 2. 🔌 CONEXIÓN DE CHRONOS (The Wiring)

**¿Cómo obtiene Chronos acceso al motor?**

| Método | ¿Se Usa? | Ubicación |
|--------|----------|-----------|
| A) Import instancia global | ❌ NO | - |
| B) Contexto React | ❌ NO | - |
| C) Nueva instancia local | ❌ NO | - |
| D) **Zustand Stores** | ✅ SÍ | `controlStore`, `overrideStore` |
| E) **IPC via window.lux** | ✅ SÍ | Para backend |

**ChronosLayout.tsx (líneas 58-59):**
```typescript
import { useControlStore, type LivingPaletteId } from '../../stores/controlStore'
import { useOverrideStore } from '../../stores/overrideStore'
```

**VEREDICTO:** Chronos usa los **mismos Zustand stores globales** que el resto del sistema. NO crea instancias duplicadas.

### 3. 💀 CICLO DE VIDA (Mount/Unmount)

**ContentArea.tsx - Navegación:**
```typescript
// Línea 28
const ChronosStudio = lazy(() => import('../../chronos/ui/ChronosLayout'))

// Línea 111
case 'chronos':
  return <ChronosStudio />
```

**¿Hay cleanup destructivo al salir del Dashboard?**

| Componente | Cleanup en unmount | Destructivo? |
|------------|-------------------|--------------|
| DashboardView | No hay cleanup especial | ❌ No |
| PowerButton | No tiene cleanup | ❌ No |
| CommandDeck | Solo unsubscribe de IPC | ❌ No |
| ChronosLayout | Cleanup de subscriptions | ❌ No |

**VEREDICTO:** Ningún componente ejecuta `.dispose()` o `.reset()` al desmontarse. Los stores persisten.

### 4. 🧠 ESTADO "ARMED/LIVE" (State Persistence)

**LOS 3 SWITCHES IDENTIFICADOS:**

| Switch | Ubicación | Store | Persistencia |
|--------|-----------|-------|--------------|
| **⚡ POWER** (TitanEngine ON/OFF) | `DashboardView/PowerButton.tsx` | `usePowerStore` (Zustand) | ✅ GLOBAL |
| **🧬 RX/IA** (Consciousness ON/OFF) | `CommandDeck.tsx` línea 29 | `controlStore.aiEnabled` | ✅ GLOBAL |
| **🚦 GO** (DMX Output ON/OFF) | `CommandDeck.tsx` línea 34 | `controlStore.outputEnabled` | ✅ GLOBAL |

**Dónde vive cada estado:**

```
┌─────────────────────────────────────────────────────────────────────┐
│ FRONTEND (Renderer Process)                                        │
├─────────────────────────────────────────────────────────────────────┤
│ usePowerStore (Zustand)                                             │
│   └── powerState: 'OFFLINE' | 'STARTING' | 'ONLINE'                 │
│                                                                     │
│ useControlStore (Zustand)                                           │
│   ├── aiEnabled: boolean (RX/IA switch)                             │
│   └── outputEnabled: boolean (GO switch) ← SYNC con backend         │
└─────────────────────────────────────────────────────────────────────┘
                              │ IPC
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ BACKEND (Main Process)                                              │
├─────────────────────────────────────────────────────────────────────┤
│ MasterArbiter (Singleton)                                           │
│   └── _outputEnabled: boolean ← SOURCE OF TRUTH para DMX            │
│                                                                     │
│ TitanOrchestrator (Singleton)                                       │
│   ├── isRunning: boolean                                            │
│   └── consciousnessEnabled: boolean                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### 5. 🔄 FLUJO DE SINCRONIZACIÓN

**CommandDeck.tsx (líneas 47-89):**
```typescript
// Subscribe to arbiter status changes
useEffect(() => {
  // Initial fetch - includes outputEnabled state
  const fetchStatus = async () => {
    const response = await window.lux?.arbiter?.status()
    // Sync outputEnabled from backend
    setOutputEnabled(response.status?.outputEnabled ?? false)
  }
  
  // Subscribe to changes
  const unsubscribe = window.lux?.arbiter?.onStatusChange?.((status) => {
    setOutputEnabled(status.outputEnabled)
  })
})
```

**IMPORTANTE:** El CommandDeck hace fetch inicial del estado del backend cuando se monta. Si navegas a Chronos (que NO tiene CommandDeck), al volver el CommandDeck lee el estado ACTUAL del backend.

---

## 🎯 DIAGNÓSTICO FINAL

### ✅ NO HAY BUGS ARQUITECTÓNICOS

1. **Motor NO es duplicado:** TitanEngine vive dentro de TitanOrchestrator singleton
2. **Stores son globales:** Zustand persiste entre navegaciones
3. **Estado ARMED vive en:** `MasterArbiter._outputEnabled` (backend) + `controlStore.outputEnabled` (frontend sync)
4. **No hay cleanup destructivo:** Ningún componente mata el motor al salir

### ⚠️ LA PERCEPCIÓN DEL PROBLEMA

Lo que probablemente percibes como "pérdida de estado" es:

1. **Chronos NO tiene CommandDeck visible** → No ves los switches GO/RX
2. **Chronos NO tiene PowerButton visible** → No ves si el motor está ON
3. **Al volver al Dashboard**, el CommandDeck hace fetch y muestra el estado REAL

### 🔧 POSIBLES MEJORAS (No son bugs)

| Mejora | Descripción | Prioridad |
|--------|-------------|-----------|
| **Mini Status Bar en Chronos** | Mostrar 3 LEDs: POWER | RX | GO | 🟡 Media |
| **Chronos Header con estado** | Badge que muestre "ENGINE: LIVE" o "ENGINE: OFF" | 🟡 Media |
| **Command Deck Mini** | Versión compacta del CommandDeck para Chronos | 🟢 Baja |

---

## 📊 MAPA DE DEPENDENCIAS

```
┌─────────────────────────────────────────────────────────────────────┐
│                        RENDERER PROCESS                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐          │
│   │ Dashboard   │     │   Chronos   │     │ LiveStage   │          │
│   │ PowerButton │     │   Layout    │     │             │          │
│   │ CommandDeck │     │ StagePreview│     │             │          │
│   └──────┬──────┘     └──────┬──────┘     └──────┬──────┘          │
│          │                   │                   │                  │
│          └───────────────────┼───────────────────┘                  │
│                              ▼                                      │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │                    ZUSTAND STORES (Globales)                 │  │
│   ├─────────────────┬─────────────────┬─────────────────────────┤  │
│   │ usePowerStore   │ useControlStore │ useOverrideStore        │  │
│   │ powerState      │ outputEnabled   │ overrides               │  │
│   │                 │ aiEnabled       │                         │  │
│   │                 │ activePalette   │                         │  │
│   └────────┬────────┴────────┬────────┴────────────┬────────────┘  │
│            │                 │                      │               │
└────────────┼─────────────────┼──────────────────────┼───────────────┘
             │                 │                      │
             │ window.lux.start│window.lux.arbiter    │ (stores internos)
             ▼                 ▼                      │
┌─────────────────────────────────────────────────────────────────────┐
│                         MAIN PROCESS                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │              TitanOrchestrator (Singleton)                   │  │
│   │  ├── TitanEngine (interno, no singleton)                     │  │
│   │  ├── TrinityBrain                                            │  │
│   │  ├── HardwareAbstraction (HAL)                               │  │
│   │  └── import { masterArbiter }                                │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │              MasterArbiter (Singleton Global)                │  │
│   │  └── _outputEnabled: boolean ← DMX Gate                      │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🏁 CONCLUSIÓN

**El sistema está bien diseñado.** Los Zustand stores persisten globalmente. El estado del backend se sincroniza via IPC.

**La "pérdida" percibida es visual, no arquitectónica:**
- Chronos no muestra los controles de estado del motor
- Al navegar de vuelta, los controles reflejan el estado REAL (que siempre estuvo ahí)

**RECOMENDACIÓN:** Agregar indicadores visuales de estado del motor en Chronos para dar feedback al usuario sin necesidad de volver al Dashboard.

---

**Firmado:** PunkOpus 🔧  
**WAVE 2016: OPERATION OPEN HEART - COMPLETADA**
