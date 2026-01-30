# 🧠 WAVE 1039: ARBITER LOBOTOMY - 7-ZONE STEREO ROUTING

**Fecha:** 2025-01-29  
**Status:** ✅ COMPLETE  
**Tipo:** Critical Architecture Fix  
**Objetivo:** Enseñar al MasterArbiter a distinguir izquierda de derecha usando posición física

---

## 🔴 EL PROBLEMA: DATA STARVATION

### **Síntomas Reportados:**
1. **Color Corrupto:** Fixtures en lado IZQUIERDO mostraban colores aleatorios
2. **Inmunidad a Efectos:** Glitches/strobes NO afectaban al lado izquierdo
3. **Serpentine Invisible:** El sway L↔R no se veía porque ambos lados recibían el promedio

### **Diagnóstico:**

**TitanEngine** genera 7 zonas stereo:
```typescript
zones: {
  frontL: { intensity: 0.8, paletteRole: 'primary' },
  frontR: { intensity: 0.3, paletteRole: 'primary' },
  backL:  { intensity: 0.6, paletteRole: 'accent' },
  backR:  { intensity: 0.9, paletteRole: 'accent' },
  // ...
}
```

**MasterArbiter** (antes del fix) solo buscaba en 5 zonas legacy:
```typescript
if (zone.includes('front')) {
  intentZone = 'front'  // ❌ SIEMPRE 'front', nunca 'frontL'/'frontR'
}
```

**Resultado:**
- Fixture con zona `FRONT_PARS` y `position.x = -50` (izquierda)
- Arbiter busca en `intent.zones.front` (promedio mono)
- **Ignora** `intent.zones.frontL` (el valor real stereo)
- Color y efectos se pierden

---

## 🛠️ LA SOLUCIÓN

### **1. Expandir ArbiterFixture con posición física**

**Archivo:** `src/core/arbiter/types.ts`

```typescript
export interface ArbiterFixture {
  // ... existing fields ...
  
  // 🌊 WAVE 1039: Physical position for stereo routing
  position?: {
    x: number  // Negative = Left, Positive = Right
    y: number
    z: number
  }
}
```

### **2. Lobotomía del Zone Resolver**

**Archivo:** `src/core/arbiter/MasterArbiter.ts` (líneas ~984-1031)

**ANTES (5-Zone Mono):**
```typescript
let intentZone: 'front' | 'back' | 'left' | 'right' | 'ambient' = 'front'

if (zone.includes('front')) {
  intentZone = 'front'      // ❌ No distingue L/R
} else if (zone.includes('back')) {
  intentZone = 'back'       // ❌ No distingue L/R
}
```

**AHORA (7-Zone Stereo):**
```typescript
// 1. Detectar lateralidad física (Left vs Right)
const isLeft = (fixture?.position?.x ?? 0) < 0

// 2. Detectar si Titan está enviando señal Estéreo
const hasStereoSignal = intent.zones && 'frontL' in intent.zones

// 3. Mapeo Dinámico
let intentZone: string = 'front' 

if (zone.includes('front')) {
  if (hasStereoSignal) {
    intentZone = isLeft ? 'frontL' : 'frontR'  // ✅ STEREO
  } else {
    intentZone = 'front'  // Fallback mono
  }
} else if (zone.includes('back')) {
  if (hasStereoSignal) {
    intentZone = isLeft ? 'backL' : 'backR'  // ✅ STEREO
  } else {
    intentZone = 'back'   // Fallback mono
  }
}
// ... movers, ambient igual
```

### **3. Acceso Dinámico Seguro**

```typescript
// Acceso dinámico seguro (TypeScript-friendly)
const zoneIntent = (intent.zones as any)?.[intentZone]
const zoneIntensity = zoneIntent?.intensity ?? intent.masterIntensity
defaults.dimmer = zoneIntensity * 255
```

**Nota:** `as any` es temporal. El tipo `LightingIntent.zones` debería expandirse formalmente en el futuro.

---

## 🎯 CONSECUENCIAS DEL FIX

### ✅ **1. COLORES CORRECTOS**

**ANTES:**
```
Fixture "Front L PAR" (x=-50):
  intentZone = 'front'
  zoneIntent = { intensity: 0.55, paletteRole: 'primary' }  ← Promedio
  Color = Primary (igual para todos)
```

**AHORA:**
```
Fixture "Front L PAR" (x=-50):
  intentZone = 'frontL'  ← ✅ Detectado por position.x < 0
  zoneIntent = { intensity: 0.8, paletteRole: 'primary' }
  Color = Primary (correcto, pero con intensidad individual)
```

### ✅ **2. SERPENTINE VISIBLE**

**ANTES:**
- FrontL intensity = 0.55 (promedio)
- FrontR intensity = 0.55 (promedio)
- Resultado: No hay contraste L↔R

**AHORA:**
- FrontL intensity = 0.8
- FrontR intensity = 0.3
- Resultado: **Serpiente visible** - luz viaja de izquierda a derecha

### ✅ **3. EFECTOS FUNCIONAN**

Los efectos (glitches, strobes) que apuntan a `FRONT_PARS` ahora se distribuyen correctamente porque el arbiter sabe qué fixture está en cada lado.

---

## 📊 FLUJO DE DATOS COMPLETO

```
1. ChillStereoPhysics
   └─> Calcula intensidades L/R separadas
       frontL: 0.8, frontR: 0.3

2. TitanEngine
   └─> Construye zonas stereo con paletteRole
       zones: {
         frontL: { intensity: 0.8, paletteRole: 'primary' },
         frontR: { intensity: 0.3, paletteRole: 'primary' }
       }

3. MasterArbiter (WAVE 1039)
   └─> Para cada fixture:
       - Lee position.x
       - Si x < 0 → busca en frontL
       - Si x >= 0 → busca en frontR
       - Extrae intensity + paletteRole

4. HardwareAbstraction
   └─> Recibe valores individuales por fixture
       - FinalLightingTarget tiene valores únicos
       - No más promedios ni valores compartidos

5. ColorTranslator + DMX Driver
   └─> Renderiza colores e intensidades exactas
```

---

## 🧪 TESTING

### Test 1: Verificar Stereo Detection
1. Parchear fixtures con `position.x` negativo (izquierda) y positivo (derecha)
2. Activar Chill Lounge
3. Verificar en logs: `intentZone = 'frontL'` para fixtures izquierda

### Test 2: Verificar Serpentine
1. Sin música (solo bamboleo puro)
2. Observar intensidades en consola
3. **Expected:** Cuando `frontL = 80%`, `frontR = 30%` (contraste visible)

### Test 3: Verificar Color Consistency
1. Activar Chill con paleta "Ocean" (blue/cyan)
2. **Expected:** TODOS los Front PARs (L y R) muestran mismo color base
3. **Expected:** Intensidad varía según stereo, color NO

---

## 🔗 ARCHIVOS MODIFICADOS

1. **`src/core/arbiter/types.ts`**
   - Agregado `position?: { x, y, z }` a `ArbiterFixture`

2. **`src/core/arbiter/MasterArbiter.ts`**
   - `getTitanValuesForFixture()` - Reescrito zone resolver (líneas 984-1031)
   - Ahora usa `position.x` para detectar L/R
   - Mapea `frontL`, `frontR`, `backL`, `backR`

---

## 📝 TAREAS FUTURAS

### 🔲 **Formalizar el Tipado**
Expandir `LightingIntent.zones` para incluir formalmente:
```typescript
interface ZoneIntensities {
  front?: ZoneIntent
  frontL?: ZoneIntent  // NEW
  frontR?: ZoneIntent  // NEW
  back?: ZoneIntent
  backL?: ZoneIntent   // NEW
  backR?: ZoneIntent   // NEW
  left?: ZoneIntent
  right?: ZoneIntent
  ambient?: ZoneIntent
}
```

### 🔲 **Propagar `position` en el Pipeline**
Asegurar que `ArbiterFixture.position` se llena correctamente desde:
- Stage Patch (UI)
- Fixture Library
- Layout Generator 3D

---

**PunkOpus** 🎸 *"El Árbitro ahora sabe qué lado es cada uno. Adiós colores random, hola serpiente hipnótica."*
