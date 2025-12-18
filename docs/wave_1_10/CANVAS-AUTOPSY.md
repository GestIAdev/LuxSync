# 🔬 CANVAS RENDERING FORENSICS - AUTOPSY REPORT

**Fecha**: 2025-12-12  
**Investigador**: Claude Opus (Forensic Canvas Analyst)  
**Objetivo**: Diagnosticar parpadeo y mezcla de colores en SimulateView  
**Prioridad**: URGENTE (Pre-Show Visual Check)

---

## 🎯 RESUMEN EJECUTIVO

**Veredicto**: El Canvas NO tiene problemas de renderizado. Los colores que muestra son **correctos** según lo que recibe del backend.

**Causa raíz del parpadeo**: Si hay flicker, proviene del **backend** (NaN en modo Flow), no del canvas.

**Causa raíz de "mezcla"**: No existe mezcla. El canvas dibuja exactamente el color que le llega en `dmxStore.fixtureValues[address].{r,g,b}`.

---

## 🕵️ HALLAZGO 1: FUENTE DE COLOR

### Variable Exacta que Alimenta el Color

**Archivo**: `src/components/views/SimulateView/index.tsx`  
**Líneas**: 86-126

```typescript
const renderableFixtures = useMemo(() => {
  const fixtureValues = new Map(fixtureValuesArray)  // ← Zustand store
  
  return patchedFixtures.map((f) => {
    const liveValues = fixtureValues.get(f.dmxAddress)  // ← Lookup por dmxAddress
    
    // 🔧 WAVE 24: Validar RGB para evitar NaN
    const hasValidRGB = liveValues 
      && !isNaN(liveValues.r) 
      && !isNaN(liveValues.g) 
      && !isNaN(liveValues.b)
    
    // Color DIRECTO desde DMX store
    const color = hasValidRGB
      ? { 
          r: Math.max(0, Math.min(255, liveValues.r)),  // ← Clampea 0-255
          g: Math.max(0, Math.min(255, liveValues.g)), 
          b: Math.max(0, Math.min(255, liveValues.b)) 
        }
      : { r: 100, g: 100, b: 100 }  // ← Fallback gris si NaN
    
    const intensity = liveValues ? liveValues.dimmer / 255 : 0.3
    
    return {
      color,
      colorStr: `rgb(${color.r}, ${color.g}, ${color.b})`,  // ← String CSS
      intensity,
      zone: f.zone,
      // ...
    }
  })
}, [patchedFixtures, fixtureValuesArray])
```

### Flujo de Datos Completo

```
┌──────────────────────────────────────────────────────────────────┐
│ BACKEND (main.ts)                                                │
├──────────────────────────────────────────────────────────────────┤
│ SeleneLux.tick() → state.colors.primary = { r, g, b }          │
│         ↓                                                        │
│ Loop 40fps → fixtureStates = patchedFixtures.map(...)          │
│         ↓                                                        │
│ fixtureStates[i] = {                                            │
│   dmxAddress: fixture.dmxAddress,                               │
│   r: fixtureColor.r,  ← Color PURO del Brain/Flow              │
│   g: fixtureColor.g,                                            │
│   b: fixtureColor.b,                                            │
│   dimmer: Math.round(intensity * 255),                          │
│   pan, tilt, zone                                               │
│ }                                                                │
│         ↓                                                        │
│ mainWindow.webContents.send('lux:state-update', {              │
│   fixtures: fixtureStates,  ← Array completo                    │
│   colors, movement, beat...                                     │
│ })                                                               │
└──────────────────────────────────────────────────────────────────┘
                          ↓ IPC
┌──────────────────────────────────────────────────────────────────┐
│ FRONTEND (TrinityProvider.tsx)                                   │
├──────────────────────────────────────────────────────────────────┤
│ window.lux.on('state-update', (seleneState) => {                │
│   updateFixtureValues(seleneState.fixtures)  ← Línea 246        │
│ })                                                               │
│         ↓                                                        │
│ dmxStore.updateFixtureValues(values)  ← Línea 264               │
│         ↓                                                        │
│ const newMap = new Map<number, FixtureValues>()                 │
│ values.forEach(v => newMap.set(v.dmxAddress, v))                │
│ set({ fixtureValues: newMap })  ← Zustand actualiza             │
└──────────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────────┐
│ CANVAS (SimulateView/index.tsx)                                 │
├──────────────────────────────────────────────────────────────────┤
│ const fixtureValuesArray = useDMXStore(                         │
│   state => Array.from(state.fixtureValues.entries())            │
│ )  ← Fuerza re-render cuando Map cambia                         │
│         ↓                                                        │
│ useMemo(() => renderableFixtures, [fixtureValuesArray])         │
│         ↓                                                        │
│ useEffect(() => {                                                │
│   requestAnimationFrame(draw)  ← 60fps render loop              │
│ }, [renderableFixtures, ...])                                   │
│         ↓                                                        │
│ ctx.fillStyle = fixture.colorStr  ← "rgb(255,0,0)"              │
│ ctx.fill()                                                       │
└──────────────────────────────────────────────────────────────────┘
```

### Conclusión del Hallazgo 1

✅ **No hay interpolación de color en el canvas**  
✅ **No lee canales DMX crudos** (lee `r,g,b` ya procesados)  
✅ **No hay mapeo incorrecto** (usa `dmxAddress` como key única)  
✅ **Tiene guard NaN** (WAVE 24, líneas 110-116)

Si el canvas muestra color incorrecto, es porque **el backend envió ese color**.

---

## 🕵️ HALLAZGO 2: LOOP DE RENDERIZADO

### Mecanismo de Refresco

**Archivo**: `src/components/views/SimulateView/index.tsx`  
**Líneas**: 139-726

```typescript
useEffect(() => {
  const canvas = canvasRef.current
  if (!canvas) return

  let animationId: number
  let time = 0

  const draw = () => {
    time += 0.02
    strobePhase.current += 0.3
    
    // Limpiar canvas
    ctx.fillStyle = '#0a0a15'
    ctx.fillRect(0, 0, width, height)
    
    // Dibujar cada fixture
    renderableFixtures.forEach((fixture) => {
      const pos = fixturePositions.get(fixture.address)
      // ...
      ctx.fillStyle = fixture.colorStr  // ← Color del snapshot
      ctx.fill()
    })
    
    animationId = requestAnimationFrame(draw)  // ← 60fps loop
  }

  draw()

  return () => cancelAnimationFrame(animationId)
}, [renderableFixtures, showBeams, showGrid, ...])  // ← Re-crea loop si cambia
```

### Frecuencias de Actualización

| Componente | Frecuencia | Mecanismo |
|------------|-----------|-----------|
| **Backend Loop** | 40 FPS | `setInterval(25ms)` en main.ts |
| **IPC Send** | 40 FPS | `mainWindow.send('lux:state-update')` |
| **Zustand Update** | 40 FPS | `dmxStore.updateFixtureValues()` |
| **useMemo Trigger** | 40 FPS | `fixtureValuesArray` dependency |
| **Canvas Draw** | 60 FPS | `requestAnimationFrame()` |

### Análisis Crítico

**Pregunta**: ¿Qué dibuja el canvas en los frames intermedios entre updates del store (40fps store → 60fps canvas)?

**Respuesta**: **Nada diferente**. El canvas dibuja el **último snapshot** de `renderableFixtures`.

**Explicación**:
1. Backend envía datos a 40fps → Zustand actualiza a 40fps
2. `useMemo` recalcula `renderableFixtures` cuando `fixtureValuesArray` cambia
3. `useEffect` se dispara cuando `renderableFixtures` cambia
4. El `draw()` loop usa el **snapshot inmutable** de `renderableFixtures`
5. En frames donde NO hay update (60fps vs 40fps), dibuja **el mismo color** otra vez

**No hay interpolación temporal**. No hay "negro entre frames". Solo re-dibuja lo último conocido.

### Conclusión del Hallazgo 2

✅ **No hay frames negros por desincronización**  
✅ **El canvas NO intenta interpolar** entre valores  
✅ **Usa snapshot inmutable** de renderableFixtures  

Si hay parpadeo, no es porque el canvas "se va a negro" entre updates.

---

## 🕵️ HALLAZGO 3: CONFLICTO DE MEZCLA (Índices Cruzados)

### Hipótesis del Usuario

> "Los PARs mezclan el color del front con el back"

### Investigación

**Pregunta**: ¿Cómo determina el canvas qué color va a qué fixture?

**Respuesta**: Por `dmxAddress` (único e inmutable).

**Código**:
```typescript
// Backend genera fixtureStates
const fixtureStates = patchedFixtures.map(fixture => {
  const zone = fixture.zone || 'UNASSIGNED'
  
  // Selecciona color según ZONA
  switch (zone) {
    case 'FRONT_PARS':
      fixtureColor = color  // ← PRIMARY
      break
    case 'BACK_PARS':
      fixtureColor = secondary  // ← SECONDARY
      break
    case 'MOVING_LEFT':
      fixtureColor = accent  // ← ACCENT
      break
    case 'MOVING_RIGHT':
      fixtureColor = ambient  // ← AMBIENT
      break
  }
  
  return {
    dmxAddress: fixture.dmxAddress,  // ← KEY ÚNICA
    r: fixtureColor.r,
    g: fixtureColor.g,
    b: fixtureColor.b,
    zone: fixture.zone
  }
})

// Canvas lee por dmxAddress
const liveValues = fixtureValues.get(f.dmxAddress)  // ← Lookup exacto
```

### Mapeo de Colores

```
Backend Generate:
┌────────────────┬─────────────┬─────────────┐
│ Zone           │ Color Fuente│ RGB Source  │
├────────────────┼─────────────┼─────────────┤
│ FRONT_PARS     │ PRIMARY     │ colors.primary   │
│ BACK_PARS      │ SECONDARY   │ colors.secondary │
│ MOVING_LEFT    │ ACCENT      │ colors.accent    │
│ MOVING_RIGHT   │ AMBIENT     │ colors.ambient   │
└────────────────┴─────────────┴─────────────┘

Canvas Lookup:
fixture.dmxAddress → fixtureValues.get(dmxAddress) → { r, g, b, zone }
                                                       ↓
                                              ctx.fillStyle = `rgb(r,g,b)`
```

### Posible Explicación de "Mezcla" Reportada

**Si el usuario ve "mezcla"**, las causas posibles son:

1. **El backend asignó mal la zona** → fixture.zone incorrecto → toma el color equivocado
2. **El Brain/Flow generó colores muy similares** → primary ≈ secondary → parece mezclado
3. **Saturación/Intensidad globales bajas** → todos los colores se vuelven grises → indistinguibles
4. **NaN en Flow Mode** → algunos fixtures obtienen fallback `{ r:100, g:100, b:100 }` → gris uniforme

### Verificación de Auto-Zoning

El backend asigna zonas en `main.ts` líneas 1470-1512 (auto-zoning).  
El canvas **NO reasigna zonas**, solo lee `fixture.zone`.

### Conclusión del Hallazgo 3

✅ **No hay mapeo de índices cruzados** en el canvas  
✅ **Cada fixture se dibuja con SU color asignado** por el backend  
✅ **No hay confusión entre Primary/Secondary/Accent**  

Si hay "mezcla visual", verificar:
- Auto-zoning correcto (fixture.zone)
- Colores procedurales distintos entre zonas
- Valores NaN causando fallback gris

---

## 🔍 DIAGNÓSTICO FINAL

### Parpadeo (Flicker)

**Origen**: Backend, NO Canvas

**Causa**: En modo Flow, si `metrics.energy` o RGB contienen NaN:
1. SeleneLux → ColorEngine genera NaN
2. applyGlobalMultipliers propaga NaN
3. Backend envía `{ r: NaN, g: NaN, b: NaN }`
4. Canvas guard detecta NaN → usa fallback `{ r:100, g:100, b:100 }`
5. Siguiente frame: valores válidos regresan → color correcto
6. **Resultado visual**: Parpadeo gris intermitente

**Solución**: WAVE 24.6 (ya implementado) - Guards anti-NaN en SeleneLux.ts

### Mezcla de Colores

**Origen**: Percepción visual, NO error de código

**Causas posibles**:
1. **Paletas similares**: Brain genera primary/secondary demasiado parecidos
2. **Saturación global baja**: UI slider de Saturation < 50% → todo gris
3. **Auto-zoning incorrecto**: Fixture asignado a zona equivocada
4. **Fallback NaN**: Múltiples fixtures reciben gris `(100,100,100)` por NaN

**Solución**: 
- Verificar auto-zoning logs
- Aumentar saturación global
- Verificar palette distinct values

---

## 📊 VALIDACIÓN DEL GUARD NaN (WAVE 24)

**Código Existente** (líneas 110-116):

```typescript
const hasValidRGB = liveValues 
  && !isNaN(liveValues.r) 
  && !isNaN(liveValues.g) 
  && !isNaN(liveValues.b)

const color = hasValidRGB
  ? { r: ..., g: ..., b: ... }
  : { r: 100, g: 100, b: 100 }  // ← Fallback seguro
```

**Veredicto**: ✅ El canvas YA tiene protección NaN

**Comportamiento**:
- Si backend envía NaN → canvas usa gris
- Si backend envía RGB válido → canvas lo muestra exacto

**Implicación**: El canvas **nunca** puede ser fuente de NaN. Solo puede mostrar lo que recibe.

---

## 🎬 CONCLUSIONES FINALES

| Aspecto | Estado | Responsable |
|---------|--------|-------------|
| **Fuente de Color** | ✅ Correcto | `dmxStore.fixtureValues[address].{r,g,b}` |
| **Render Loop** | ✅ Correcto | 60fps RAF con snapshot inmutable |
| **Índices de Color** | ✅ Correcto | Lookup por `dmxAddress` (único) |
| **Guard NaN** | ✅ Presente | WAVE 24 (líneas 110-116) |
| **Mezcla Visual** | ⚠️ Backend | Auto-zoning o paletas similares |
| **Flicker** | ⚠️ Backend | NaN en Flow Mode (WAVE 24.6 fix) |

---

## 🔧 RECOMENDACIONES

### Para Eliminar Flicker
1. ✅ **Ya implementado**: WAVE 24.6 guards en SeleneLux.ts
2. Verificar que Trinity workers NO envíen NaN en `audioAnalysis`
3. Test en modo Flow con audio simulado (sin micrófono)

### Para Distinguir Colores
1. **Aumentar saturación global** → UI slider al 100%
2. **Verificar auto-zoning** → Log en consola backend
3. **Test paletas distintas** → fuego (rojo) vs hielo (azul)
4. **Verificar Brain mode** → Modo inteligente genera más variedad

### Para Debugging
1. Añadir log temporal en canvas:
```typescript
if (fixture.zone === 'FRONT_PARS') {
  console.log('[Canvas]', fixture.name, fixture.color)
}
```
2. Comparar con log backend:
```typescript
console.log('[Backend]', fixture.zone, fixtureColor)
```
3. Si coinciden → problema está en percepción/paleta
4. Si difieren → problema está en IPC/store

---

## 📝 VEREDICTO FINAL

**El canvas NO tiene bugs de renderizado.**

Dibuja exactamente lo que recibe del backend, a 60fps, sin interpolación, sin mezcla de índices, con guard NaN.

**Si hay problemas visuales, buscar en**:
1. ✅ Backend (SeleneLux) - NaN en Flow Mode → **WAVE 24.6 soluciona**
2. ⚠️ Backend (main.ts) - Auto-zoning incorrecto
3. ⚠️ Brain - Paletas demasiado similares
4. ⚠️ UI - Saturación global muy baja

**El canvas está listo para el show. 🎯**
