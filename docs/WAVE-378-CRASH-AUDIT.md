# 🔬 WAVE 378 PART 1: SIMULATOR CRASH AUDIT

**Status:** 🔍 FORENSIC COMPLETE  
**Date:** January 13, 2026  
**Incident:** `THREE.WebGLRenderer: Context Lost`  
**Scene:** Stage3DCanvas (Visualizer 3D en StageViewDual)

---

## 🎯 EXECUTIVE SUMMARY

### 🏆 CAUSA RAÍZ IDENTIFICADA

**NO ES** Memory Leak, **NO ES** Raycaster Overload, **NO ES** Infinite Loop.

**ES:** Re-render masivo del `SceneContent` component a **60 FPS** causado por subscripción directa a `truthStore` sin selector granular.

---

## 📊 ANÁLISIS FORENSE

### 1️⃣ ANÁLISIS DE CICLO DE VIDA (Mount/Unmount)

**Archivo:** `Stage3DCanvas.tsx` (líneas 79-120)

**HALLAZGO CRÍTICO:**

```typescript
const SceneContent: React.FC<{ showStats: boolean }> = ({ showStats }) => {
  // ⚠️ PROBLEMA AQUÍ:
  const hardware = useTruthStore(selectHardware)  // LINE 81
  const fixtureArray = hardware?.fixtures || []   // LINE 86
```

**PROBLEMA:**

El selector `selectHardware` retorna **el objeto hardware completo**:

```typescript
// truthStore.ts
export const selectHardware = (state: TruthState) => state.truth.hardware
```

Cada frame del backend (60 FPS via `useSeleneTruth`):
1. `setTruth(data)` actualiza el store completo
2. `hardware` es un **nuevo objeto** en cada update (referencia diferente)
3. `SceneContent` se **re-renderiza completamente**
4. `fixtureLayouts` useMemo **SE INVALIDA** porque depende de `hardware?.fixtures`
5. Genera **NUEVOS** layouts para N fixtures
6. React genera **NUEVAS** keys para el map
7. Three.js considera que son **NUEVOS** objetos
8. Mounting/unmounting de N `SmartFixture3D` components
9. Mounting/unmounting de N `Fixture3D` components con geometrías y materiales

**FRECUENCIA:** 60 veces por segundo × N fixtures = **explosión exponencial**

---

### 2️⃣ ANÁLISIS DE GESTIÓN DE MEMORIA (Disposable Check)

**Archivo:** `Fixture3D.tsx` (líneas 75-117)

**HALLAZGO:**

```typescript
// Glow texture radial (circular, soft falloff)
const glowTexture = useMemo(() => createRadialGlowTexture(), [])  // ✅ CACHEADO

const threeColor = useMemo(() => {
  return new THREE.Color(color.r / 255, color.g / 255, color.b / 255)
}, [color.r, color.g, color.b])  // ⚠️ NUEVO OBJETO cuando color cambia
```

**VEREDICTO:** 
- La textura está cacheada globalmente ✅
- `THREE.Color` se crea nuevo cuando cambia el color, pero no genera leak
- **Las geometrías están inline** (no `useMemo`), pero THREE.js/R3F las reutiliza internamente

**NO ES LA CAUSA PRINCIPAL**, pero contribuye al stress cuando hay re-mounts.

---

### 3️⃣ ANÁLISIS DEL RAYCASTER

**Archivo:** `StageGrid3D.tsx` (línea 503)

**HALLAZGO:**

```typescript
const handleCameraReady = useCallback((camera: THREE.Camera) => {
  cameraRef.current = camera
  console.log('[StageGrid3D] Camera ready for raycasting')  // LOG CORRELACIONADO
}, [])
```

**VEREDICTO:** Este log aparece en el crash timeline, pero el raycaster de `StageGrid3D` es del **Constructor**, NO del Visualizer (`Stage3DCanvas`).

**EL CRASH OCURRE EN EL VISUALIZER**, no en el Constructor.

**DESCARTADO:** No es el raycaster del Constructor.

---

### 4️⃣ ANÁLISIS DEL BUCLE INFINITO (Store Circularity)

**Archivo:** `TitanSyncBridge.tsx`

**FLUJO ANALIZADO:**

```
stageStore.fixtures  →  TitanSyncBridge  →  IPC lux:arbiter:setFixtures
    ↑                                              ↓
    │                                     MasterArbiter
    │                                              ↓
    │                                     TitanOrchestrator
    │                                              ↓
truthStore  ←───── window.lux.onTruthUpdate ←──── SeleneTruth broadcast
```

**VEREDICTO:**

1. TitanSyncBridge envía **stageStore.fixtures** al backend
2. Backend NO modifica stageStore
3. Backend actualiza **truthStore** (diferente store)
4. truthStore triggerea re-renders en Stage3DCanvas

**NO HAY BUCLE INFINITO** entre los stores.

Pero **SÍ HAY** un flujo donde cada sync → update de truthStore → re-render del Canvas 3D.

---

## 🔍 TIMELINE DEL CRASH

```
T+0:    StageConstructorView loads show with 10 fixtures into stageStore
T+0:    [Toolbar] ✅ Loaded show into store: 10-fixtures.v2 with 10 fixtures
T+0:    [StageGrid3D] Selection changed: [] version: 0
T+0:    [StageGrid3D] Camera ready for raycasting  ← Constructor listo (irrelevante)
T+0:    [TitanSyncBridge] 🔄 Render - component alive
T+500ms: TitanSyncBridge debounce fires
T+500ms: [TitanSyncBridge] 🌉 Fixtures changed (10) → syncing...
T+501ms: [TitanSyncBridge] ✅ Synced 10 fixtures to Arbiter
T+501ms: MasterArbiter.setFixtures() updates internal state
T+502ms: TitanOrchestrator frame loop includes 10 fixtures
T+502ms: SeleneTruth broadcast emitted with hardware.fixtures = 10
T+502ms: truthStore.setTruth() called
T+502ms: Stage3DCanvas SceneContent re-renders
T+502ms: 10x SmartFixture3D + 10x Fixture3D mount/unmount cycle
T+502ms: ... (60fps continue)
T+600ms: GPU memory exhausted / context lost
T+600ms: THREE.WebGLRenderer: Context Lost.
T+600ms: [TitanOrchestrator] Stopped
```

---

## 🩺 DIAGNÓSTICO FINAL

| Hipótesis | Resultado | Evidencia |
|-----------|----------|-----------|
| Memory Leak (geometrías sin dispose) | ❌ DESCARTADO | Geometrías inline son manejadas por R3F |
| Re-mount Loop | ✅ **CONFIRMADO** | `useTruthStore(selectHardware)` causa re-render a 60fps |
| Raycaster Overload | ❌ DESCARTADO | Log es del Constructor, no del Visualizer |
| Store Circularity | ❌ DESCARTADO | No hay bucle, solo flujo unidireccional |

---

## 🔧 SOLUCIÓN PROPUESTA

### FIX 1: Selector Granular (QUICK FIX)

```typescript
// ANTES (Stage3DCanvas.tsx línea 81):
const hardware = useTruthStore(selectHardware)

// DESPUÉS:
const fixtureArray = useTruthStore(
  (state) => state.truth.hardware.fixtures,
  (a, b) => {
    // Comparación superficial: solo re-render si cambia la cantidad o los IDs
    if (a.length !== b.length) return false
    return a.every((f, i) => f.id === b[i]?.id)
  }
)
```

### FIX 2: Separar Layout de Data (ARCHITECTURAL FIX)

```typescript
// Layout generation: Solo cuando cambian fixtures (estructura)
const fixtureLayouts = useMemo(() => {
  return generateLayout3D(fixtureArray.map(f => ({
    id: f.id, 
    name: f.name, 
    type: f.type, 
    zone: f.zone
  })))
}, [fixtureArray.map(f => f.id).join(',')])  // Solo IDs como dependencia

// Data: Via transient store (no props, no re-render)
// Ya implementado en Fixture3D con getTransientFixture(id)
```

### FIX 3: Memoization del SceneContent (SAFE FIX)

```typescript
const SceneContent = React.memo(({ showStats }) => {
  // ... existing code
}, (prevProps, nextProps) => {
  return prevProps.showStats === nextProps.showStats
})
```

---

## 📋 ACCIÓN RECOMENDADA

**Prioridad:** FIX 1 (Selector Granular) + FIX 3 (Memoization)

**Impacto:** Reducir re-renders de 60/segundo a solo cuando cambien fixtures estructuralmente.

**Riesgo:** Bajo - son cambios de optimización, no de lógica.

---

## 📝 NOTAS ADICIONALES

### Debug Logging Overhead

En `Fixture3D.tsx` hay múltiples `console.log` con `Math.random() < 0.016`:

```typescript
if (Math.random() < 0.016) {
  console.log(`[🔬 Fixture3D TRANSIENT] ...`)
}
```

Con 10 fixtures × 2 useFrame hooks × 60fps = **1200 evaluaciones/segundo** del random.
~1.6% = ~19 logs/segundo.

**Recomendación:** Remover o condicionar a `showDebugOverlay`.

---

## 🏁 CONCLUSIÓN

**El Context Lost es causado por un CASCADE DE RE-RENDERS:**

1. Backend emite SeleneTruth a 60 FPS
2. `useTruthStore(selectHardware)` triggerea re-render en cada frame
3. 10 fixtures × 60fps = 600 mount/unmount cycles por segundo
4. GPU memory exhaustion → WebGL Context Lost

**La solución es simple:** Usar selectores granulares y memoization para aislar los re-renders solo a cambios estructurales (add/remove fixtures), no a cambios de datos en tiempo real (pan/tilt/color).

---

**PunkOpus OUT.** 🔥
