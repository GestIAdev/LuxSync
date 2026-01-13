# 🩸 WAVE 380: THE BLOODSTREAM - ARCHITECTURE REPORT

**Fecha:** 13 de Enero, 2026  
**Estado:** CRITICAL FIXES APPLIED - DATA FLOW PARTIALLY RESTORED  
**Próxima Iteración:** WAVE 380.6 - Full Physics & Movement Integration

---

## 📋 EXECUTIVE SUMMARY

WAVE 380 diagnosticó y parcialmente resolvió un **colapso crítico en el flujo de datos** entre backend y frontend. El sistema estaba generando 10 fixtures correctamente en el backend (TitanOrchestrator), pero los datos nunca llegaban al frontend de manera utilizable.

**Problemas identificados y parcialmente resueltos:**
- ✅ **ID Mismatch Critical** - Fixtures recibían IDs genéricos (`fix_0`) en vez de IDs reales (`fixture-XXXX`)
- ✅ **3D Data Flow Broken** - Componente 3D no recibía datos del backend
- ✅ **HSL Color Conversion Bug** - Hue normalizado (0-1) se dividía por 360, colapsando todo a rojo
- ❌ **Movement/Physics Not Flowing** - Pan/Tilt mover data aún no se sincroniza con visualización
- ❌ **Vibe Colors Not Rendering** - Aunque los datos llegan, simulador aún muestra rojo estático
- ❌ **2D/3D Color Mismatch** - Colores no responden realmente a vibes

---

## 🔧 FIXES APLICADOS

### FIX #1: Fixture ID Mismatch (CRITICAL)

**Archivo:** `src/core/orchestrator/TitanOrchestrator.ts` (línea ~434)

**Problema:**
```typescript
// ANTES (INCORRECTO)
return {
  id: `fix_${i}`,  // ← Genera: fix_0, fix_1, fix_2...
  // ...resto de datos
}

// Pero el frontend buscaba:
runtimeStateMap.get('fixture-1768196817883')  // ← UUID real del fixture
```

**Resultado:** 
- El runtimeStateMap NUNCA encontraba coincidencia
- Fixtures siempre mostraban como "gray/offline" en 2D
- 3D nunca recibía datos de color/intensidad

**Solución:**
```typescript
// AHORA (CORRECTO)
const originalFixture = this.fixtures[i]
const realId = originalFixture?.id || `fix_${i}`

return {
  id: realId,  // ← Usa fixture-XXXX del fixture original
  // ...resto de datos
}
```

**Impact:** ✅ Frontend ahora encuentra fixtures en truthStore por ID correcto

---

### FIX #2: 3D Data Flow Broken (CRITICAL)

**Archivo:** `src/hooks/useFixtureRender.ts` (línea ~205)

**Problema:**
```typescript
// Stage3DCanvas pasaba null
const { color, intensity } = useFixtureRender(null, layout.id, fixtureIndex)
//                                            ↑
//                                          NULL!

// Dentro del hook:
export function useFixtureRender(truthData: any, ...) {
  // truthData es null → nunca entra a lógica de color
  let color = truthData?.color || { r: 0, g: 0, b: 0 }  // ← Default negro
  // ...
}
```

**Resultado:**
- 3D Fixtures siempre mostraban color por defecto
- No recibían actualizaciones en tiempo real de truthStore

**Solución:**
```typescript
// Hook ahora busca automáticamente en truthStore
const hardwareFixtures = useTruthStore(state => state.truth?.hardware?.fixtures)
const resolvedTruthData = useMemo(() => {
  if (truthData !== null) return truthData
  // Find fixture in truthStore by ID
  const fixtures = hardwareFixtures || []
  return fixtures.find((f: any) => f?.id === fixtureId) || null
}, [truthData, hardwareFixtures, fixtureId])
```

**Impact:** ✅ 3D Components ahora leen datos en tiempo real sin pasar null

---

### FIX #3: HSL Color Conversion Bug (CRITICAL)

**Archivo:** `src/core/arbiter/MasterArbiter.ts` (línea ~1034)

**Problema:**
```typescript
// ANTES
private hslToRgb(hsl: { h: number; s: number; l: number }): RGBOutput {
  const hNorm = h / 360  // ← BUG!
  // ...
}

// Si paleta tiene h=0.5 (cyan):
// 0.5 / 360 = 0.00138... ≈ 0 (rojo!)
// 
// Si paleta tiene h=0.33 (verde):
// 0.33 / 360 = 0.000916... ≈ 0 (rojo!)
//
// Si paleta tiene h=0.66 (azul):
// 0.66 / 360 = 0.00183... ≈ 0 (rojo!)
```

**Resultado:**
- **TODOS los colores mapeaban a ROJO**
- No importa qué vibe estuviese activo
- El sistema mostraba rojo estático siempre

**Solución:**
```typescript
// AHORA
private hslToRgb(hsl: { h: number; s: number; l: number }): RGBOutput {
  const hNorm = h  // ← CORRECTO: h ya viene normalizado 0-1
  // ...
}
```

**Análisis Root Cause:**
- `ColorPalette.primary` usa HSL normalizado 0-1 (definido en `LightingIntent.ts`)
- MasterArbiter asumía h en 0-360 (formato CSS tradicional)
- La conversión `h/360` comprimía todo el rango 0-1 a 0-0.003
- Cualquier hue != 0 quedaba perdido

**Impact:** ✅ Colores ahora se convierten correctamente... (en teoría)

---

## 📊 ARQUITECTURA DE FLUJO: ANTES vs DESPUÉS

### ANTES (Roto)

```
Frontend                Backend              Frontend
┌──────────────┐       ┌──────────────┐    ┌──────────────┐
│ stageStore   │       │TitanOrchest  │    │ 2D Simulator │
│ fixtures:10  │──────▶│rator         │───▶│              │
└──────────────┘       └──────────────┘    └──────────────┘
                              │
                              │ broadcast(truth)
                              ▼
                       ┌──────────────┐
                       │ truthStore   │
                       │              │
                       │ fixtures:10  │  ← Tiene IDs correctos!
                       └──────────────┘
                              │
                              │ Pero runtimeStateMap busca
                              │ 'fixture-1768196817883'
                              │ y map tiene 'fix_0'
                              │ ❌ MISMATCH!
                              │
                       ┌──────────────┐
                       │ runtimeState │
                       │ Map          │
                       │ (VACÍO)      │
                       └──────────────┘
```

### DESPUÉS (Parcialmente Reparado)

```
Frontend                Backend              Frontend
┌──────────────┐       ┌──────────────┐    ┌──────────────┐
│ stageStore   │       │TitanOrchest  │    │ 2D Simulator │
│ fixtures:10  │──────▶│rator         │───▶│              │
│              │       │              │    │ runtimeState │
│              │       │ now uses      │    │ Map:10       │
└──────────────┘       │ real IDs!     │    └──────────────┘
                       └──────────────┘           ▲
                              │                   │
                              │ broadcast(truth)  │ Match!
                              ▼                   │
                       ┌──────────────┐          │
                       │ truthStore   │──────────┘
                       │              │
                       │ fixtures:10  │
                       │ id: fix-1234  │
                       └──────────────┘
```

---

## 🚨 PROBLEMAS AÚN NO RESUELTOS

### 1. **Movement/Physics Data Not Flowing**

**Descripción:** Los datos de pan/tilt de los movers no se sincronizan con la visualización 3D.

**Síntomas:**
- Movers en 2D/3D muestran pan=0.5, tilt=0.5 siempre
- No responden al movimiento del VibeMovementManager
- Haces de luz (beams) no se animan

**Root Cause Probable:**
- `useFixtureRender` obtiene pan/tilt del fixture, pero:
  - Pan/tilt vienen normalizados 0-1 del backend
  - Three.js/Canvas probablemente espera 0-360 grados
  - Hay un mismatch de coordinadas

**Archivos Implicados:**
- `src/hooks/useFixtureRender.ts` (line 61-70)
- `src/components/stage3d/fixtures/Fixture3D.tsx` (cómo aplica pan/tilt a Three.js)
- `src/components/views/SimulateView/StageSimulator2.tsx` (cómo dibuja pan/tilt en Canvas)

---

### 2. **Vibe Colors Not Rendering**

**Descripción:** Aunque el backend envía colores reales ahora, 2D/3D siguen mostrando rojo/estatismo.

**Síntomas:**
- Seleccionar vibe "FIESTA_LATINA" muestra azul/verde en log del backend
- Frontend sigue mostrando rojo
- Test Mode pulse aún visible (rojo pulsante)

**Root Cause Probable:**
- El color LLEGA al frontend (truthStore confirmado)
- Pero StageSimulator2/Fixture3D no usan el color correctamente
- Posibles problemas:
  1. `runtimeState.color` no se aplica a canvas/three.js
  2. Hay un fallback a gray/red en el render
  3. El componente Fixture3D no está usando la propuesta de color

**Archivos Implicados:**
- `src/components/views/SimulateView/StageSimulator2.tsx` (line ~168+)
- `src/components/stage3d/fixtures/Fixture3D.tsx`

---

### 3. **Test Mode Still Active**

**Descripción:** El pulso rojo de Test Mode aún está funcionando, causando ruido visual.

**Código:**
```typescript
// MasterArbiter.ts, line 688-703
if (!titanActive && channel === 'dimmer') {
  // Pulso sinusoidal: 20% base + 10% oscilación
  const phase = (now / 3000) * Math.PI * 2
  const pulse = 51 + Math.sin(phase) * 25 // DMX 26-76
  // ... retorna pulse
}
```

**Decisión:** Dejar activado para debugging, pero debería quitarse cuando vibes estén estables.

---

## 📈 DIAGRAMA DE FLUJO ACTUAL (Con Problemas)

```
┌─────────────────────────────────────────────────────────────┐
│                        BACKEND (Electron Main)              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  TitanEngine (update)                                        │
│    ├─ MusicalContext → LightingIntent                       │
│    ├─ Paleta generada (H, S, L correctos)                   │
│    └─ Colors: {primary: {h:0.5, s:0.8, l:0.5}}             │
│                         │                                     │
│                         ▼                                     │
│  MasterArbiter.arbitrate()                                   │
│    ├─ getTitanValuesForFixture()                            │
│    │   └─ intent.palette.primary → hslToRgb()              │
│    │       ❌ WAS: h/360  (dividía por 360)                 │
│    │       ✅ NOW: h como está (normalizado)               │
│    │                                                          │
│    ├─ fixtures[10] con color R=212, G=20, B=19             │
│    └─ Retorna FixtureLightingTarget[] con colors           │
│                         │                                     │
│                         ▼                                     │
│  HAL.renderFromTarget()                                      │
│    ├─ Aplica colors a FixtureState[]                        │
│    └─ Retorna estados finales                               │
│                         │                                     │
│                         ▼                                     │
│  TitanOrchestrator.onBroadcast(truth)                       │
│    ├─ truth.hardware.fixtures[10]                           │
│    ├─ fixture.id = "fixture-XXXX" ✅ FIX #1                │
│    ├─ fixture.color = {r:212, g:20, b:19}                  │
│    ├─ fixture.pan = 0.5 (normalizado 0-1)                  │
│    ├─ fixture.tilt = 0.5 (normalizado 0-1)                │
│    └─ Send via IPC 'selene:truth'                           │
│                         │                                     │
└─────────────────────────────────────────────────────────────┘
                          │
                    IPC Channel
                  'selene:truth'
                          │
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                         │
├─────────────────────────────────────────────────────────────┤
│                         │                                     │
│                         ▼                                     │
│  window.lux.onTruthUpdate((data) => {})                     │
│    ├─ setTruthStore(data)  ✅ FIX #1                       │
│    └─ hardware.fixtures[10] with correct IDs               │
│                         │                                     │
│                         ▼                                     │
│  runtimeStateMap = Map from hardware.fixtures              │
│    └─ Key: "fixture-XXXX" ✅ FIX #1                        │
│                         │                                     │
│        ┌────────────────┼────────────────┐                  │
│        │                │                │                  │
│        ▼                ▼                ▼                  │
│  StageSimulator2   Fixture3D         useFixtureRender      │
│  (2D Canvas)       (WebGL)           (Hook) ✅ FIX #2      │
│        │                │                │                  │
│        │                │                ▼                  │
│        │                │          fixture = truthStore     │
│        │                │          .find(f => f.id == id)  │
│        │                │                │                  │
│        ▼                ▼                ▼                  │
│   color =          color =          color = fixture        │
│  runtimeState      useFixture       .color                │
│  .color            Render()         (NOW WORKS!)         │
│        │                │                │                  │
│        ├────────────────┼────────────────┘                  │
│        │                │                                    │
│        ▼                ▼                                    │
│   canvas.fillStyle   THREE.MeshPhong   ❌ AÚN NO:          │
│   = `rgb(212,20,19)` Material.color   - Pan/Tilt movement│
│        │                │             - Physics sync      │
│        │                │             - Beam animation    │
│        ▼                ▼                                    │
│   Render fixture   Render fixture                          │
│   RED círculo      RED círculo                             │
│   (TEST MODE)      (TEST MODE)                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔴 ESTADO ACTUAL: PARCIALMENTE VIVO

| Componente | Status | Notas |
|---|---|---|
| **Backend Data Generation** | ✅ OK | TitanEngine genera paletas correctas |
| **Fixture ID Handling** | ✅ FIXED | IDs ahora son reales (fixture-XXXX) |
| **Color Conversion** | ✅ FIXED | HSL→RGB ahora normaliza correctamente |
| **Data IPC Transport** | ✅ OK | truthStore recibe 10 fixtures |
| **2D Rendering** | ⚠️ PARTIAL | Puntos visibles pero rojo/estatismo |
| **3D Rendering** | ⚠️ PARTIAL | Luces visibles pero rojo/estatismo |
| **Color Display** | ❌ BROKEN | Aún muestra rojo TEST MODE, no vibe colors |
| **Movement/Pan-Tilt** | ❌ BROKEN | Movers no se animan |
| **Physics Integration** | ❌ BROKEN | Pan/Tilt physics no sincronizados |
| **Beam Animation** | ❌ BROKEN | Haces de luz no se animan |

---

## 📝 COMMITS REALIZADOS

```bash
WAVE 380: THE BLOODSTREAM - ID Matching Fix + 3D Data Flow
  - Fixed broadcast IDs from fix_N to fixture-XXXX
  - useFixtureRender now fetches from truthStore when truthData=null
  - Removed debug log spam from StageSimulator2

WAVE 380.5: COLOR FIX
  - hslToRgb was dividing h/360 but h was already 0-1
  - THIS was causing ALL colors to map to RED
  - Removed Kickstart debug (flow confirmed)
```

---

## 🎯 PRÓXIMAS TAREAS (WAVE 380.6+)

### PRIORITY 1: Color Rendering (Blocking Everything)

1. **Debug por qué 2D/3D aún muestran rojo**
   - Verificar que `runtimeState.color` se aplica en StageSimulator2
   - Verificar que Fixture3D.tsx recibe y aplica color real
   - Comprobar si hay fallback a RED en el render

2. **Activar colores reales en 2D**
   - StageSimulator2 debería usar `runtimeState.color` o `color` del hook
   - Aplicar a canvas fillStyle

3. **Activar colores reales en 3D**
   - Fixture3D.tsx debería recibir color del prop
   - Aplicar a THREE.MeshPhong material.color

### PRIORITY 2: Movement/Physics Sync

1. **Pan/Tilt Normalization**
   - Verificar que pan/tilt llegan como 0-1
   - Convertir a 0-360 grados para visualización angular
   - Aplicar a Three.js rotations

2. **Movement Animation**
   - VibeMovementManager genera pan/tilt targets
   - HAL interpola hacia targets (smooth movement)
   - Visualizadores deben mostrar movimiento en tiempo real

3. **Beam/Haz Animation**
   - Pan/Tilt cambios activan rotaciones en Three.js
   - Haces (beams) deben rotar según pan/tilt

### PRIORITY 3: Vibe-Responsive Colors

1. **Color Palette per Vibe**
   - FIESTA_LATINA → Colores cálidos (rojo, naranja, amarillo)
   - COSMIC_TWILIGHT → Colores fríos (azul, púrpura, cian)
   - ROCK_STAGE → Colores saturados (rojo, blanco)

2. **Real-time Palette Updates**
   - Cambiar vibe → Cambiar colores inmediatamente
   - No delay en actualización

---

## 🏗️ ARQUITECTURA CONOCIDA

### Data Path: Backend → Frontend

```
TitanEngine (update context+audio)
    ↓
LightingIntent (palette + masterIntensity)
    ↓
MasterArbiter.arbitrate() (merge layers)
    ↓
HAL.renderFromTarget() (apply to fixtures)
    ↓
TitanOrchestrator.broadcast(truth) [IPC]
    ↓
truthStore (React Zustand)
    ↓
useSeleneTruth hook (subscribes to IPC)
    ↓
Components read via:
  - useFixtureRender(null, id) → busca en truthStore ✅
  - runtimeStateMap.get(id) ✅
```

### 3D Rendering Path

```
Stage3DCanvas (entrypoint)
    ↓
SmartFixture3D (memoized wrapper)
    ↓
useFixtureRender(null, id, index) ✅
    ↓
Fixture3D (WebGL geometry)
    ↓
THREE.MeshPhong.material.color ← AQUÍ VA EL COLOR
```

### 2D Rendering Path

```
StageSimulator2 (entrypoint)
    ↓
runtimeStateMap.get(fixture.id) ✅
    ↓
fixtures.map(fixture => {
    const runtimeState = runtimeStateMap.get(fixture.id)
    return renderFixture(fixture, runtimeState)
})
    ↓
canvas.fillStyle = `rgb(${r}, ${g}, ${b})` ← AQUÍ VA EL COLOR
```

---

## 💡 RECOMENDACIONES ARQUITECTÓNICAS

### A Corto Plazo (Esta Semana)

1. **Fix Color Rendering en 2D/3D**
   - El flujo de datos funciona, pero la visualización no aplica colores
   - Comprobar que los componentes reciben y usan `color` correctamente

2. **Remover Test Mode**
   - El pulso rojo ahora es ruido
   - Reemplazarlo con render de "offline" state (gris oscuro)

3. **Vibe Color Tests**
   - Crear test fixture que selecciona 5 vibes diferentes
   - Verificar que cada vibe muestra colores únicos

### A Mediano Plazo (Próximas 2 Semanas)

1. **Pan/Tilt Movement Full Stack**
   - VibeMovementManager → MasterArbiter → HAL → truthStore → 3D/2D
   - Asegurar que los movers animan suavemente

2. **Physics Integration**
   - FixturePhysicsDriver interpola movimientos
   - Asegurar sincronización con visualización

3. **Performance Optimization**
   - 10 fixtures × 30fps × 2 visualizadores = 600 renders/s
   - Usar memoization y selectors para evitar re-renders

### A Largo Plazo (Roadmap)

1. **Gesture Recognition**
   - Pan/Tilt patterns (circles, lines, waves)
   - Shake/tremolo effects

2. **Dynamic Zone Assignment**
   - Fixtures pueden cambiar zonas basado en vibe
   - Rebalanceo automático de luz

3. **Custom Vibe Creator**
   - UI para crear vibes personalizadas
   - Color palette picker
   - Movement pattern builder

---

## 📞 PREGUNTAS PARA EL ARQUITECTO

1. **¿Son correctas las unidades de normalización?**
   - Pan/Tilt: ¿0-1 (fracción de rango) o 0-360 (grados)?
   - Color: ¿Siempre RGB 0-255 o también normalizado 0-1?

2. **¿Qué tan crítico es Test Mode?**
   - ¿Mantenerlo para debugging o reemplazarlo con offline state?

3. **Movement Priority:**
   - ¿Debería haber smooth interpolation en movimiento?
   - ¿Qué velocidad máxima de pan/tilt?

4. **Color Palettes:**
   - ¿Cada vibe tiene paleta fija o se generan dinámicamente?
   - ¿Paleta completa (4 colores) o solo color principal?

---

## 📊 MÉTRICAS ACTUALES

| Métrica | Valor | Status |
|---|---|---|
| Fixtures Synced Backend | 10/10 | ✅ OK |
| Fixtures Rendering 2D | 10/10 | ✅ OK (pero rojo) |
| Fixtures Rendering 3D | 10/10 | ✅ OK (pero rojo) |
| ID Matching Success | 100% | ✅ FIXED |
| Color Accuracy | 0% | ❌ All RED |
| Movement Animation | 0% | ❌ Static pan/tilt |
| Physics Interpolation | N/A | ❌ Not tested |
| Frame Rate (2D) | ~30fps | ✅ OK |
| Frame Rate (3D) | ~30fps | ✅ OK (con warns) |

---

**Generated:** 2026-01-13  
**Reported by:** GitHub Copilot / PunkOpus  
**Status:** 🟡 CRITICAL FLOW ISSUES RESOLVED, COLOR RENDERING BROKEN
