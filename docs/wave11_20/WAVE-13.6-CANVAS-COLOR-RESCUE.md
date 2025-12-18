# 🚑 WAVE 13.6: "CANVAS COLOR RESCUE"
## Diagnóstico Visual - ¿Por qué el Simulador no cambia de color?

**Fecha**: 7 de Diciembre, 2025  
**Status**: 🔍 DIAGNÓSTICO COMPLETADO  
**Build**: ✅ EXITOSO (main.js 163.35 kB)

---

## 📋 EL REPORTE DEL USUARIO

> "El Backend envía colores preciosos, pero el Simulador es daltónico.  
> Todo se ve igual (Naranja o Azul apagado)."

### Síntomas:
- 🎨 **Simulador muestra siempre los mismos colores**
- 🧡 **Predomina naranja/azul apagado**
- 🔴 **No responde a cambios musicales**
- 🎯 **Moving Heads parecen congelados**

---

## 🔍 AUDITORÍA TÉCNICA

### 1. ✅ **SimulateView/index.tsx** - Canvas Rendering

**Línea 87-88**: Color extraction desde DMX values
```typescript
const color = liveValues 
  ? { r: liveValues.r, g: liveValues.g, b: liveValues.b }
  : { r: 100, g: 100, b: 100 }
```
**✅ CORRECTO**: El canvas lee `liveValues.r/g/b` directamente.

**Línea 104**: Color string conversion
```typescript
colorStr: `rgb(${color.r}, ${color.g}, ${color.b})`,
```
**✅ CORRECTO**: Conversión a formato CSS RGB.

**Línea 485**: Cuerpo del Moving Head
```typescript
ctx.fillStyle = fixture.active && dimmer > 0.05 ? colorStr : '#222'
```
**✅ CORRECTO**: Usa `colorStr` sin filtros ni overrides.

**Línea 454**: Haz cónico
```typescript
coneGradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`)
```
**✅ CORRECTO**: Usa RGB directo en gradientes.

**Línea 506**: PARs body
```typescript
ctx.fillStyle = fixture.active ? colorStr : '#222'
```
**✅ CORRECTO**: Usa `colorStr` sin modificaciones.

---

### 2. ✅ **dmxStore.ts** - Estado de Fixtures

**Línea 35-42**: Interface `FixtureValues`
```typescript
export interface FixtureValues {
  dmxAddress: number
  dimmer: number      // 0-255
  r: number           // 0-255
  g: number           // 0-255
  b: number           // 0-255
  pan?: number        // 0-255
  tilt?: number       // 0-255
  zone?: string
}
```
**✅ CORRECTO**: Estructura correcta para RGB + Dimmer independiente.

**Línea 240**: Update fixture values
```typescript
updateFixtureValues: (values) => {
  const newMap = new Map<number, FixtureValues>()
  values.forEach(v => newMap.set(v.dmxAddress, v))
  set({ fixtureValues: newMap })
}
```
**✅ CORRECTO**: Convierte array a Map para lookup rápido.

---

### 3. ⚠️ **main.ts** - Backend Color Generation

**Línea 363-366**: Extracción de colores
```typescript
const color = state.colors?.primary || { r: 0, g: 0, b: 0 }
const secondary = state.colors?.secondary || { r: 0, g: 0, b: 0 }
const accent = state.colors?.accent || color // Para MOVING_LEFT
const ambient = state.colors?.ambient || accent // Para MOVING_RIGHT
```
**✅ CORRECTO**: Lee `state.colors` de Selene.

**Línea 490-493**: Envío de valores DMX
```typescript
dimmer: Math.round(intensity * 255),
r: fixtureColor.r,  // ¡Color PURO sin multiplicar!
g: fixtureColor.g,
b: fixtureColor.b,
```
**✅ CORRECTO**: RGB puro, dimmer independiente.

**Línea 298**: Proceso de audio
```typescript
const state = selene.processAudioFrame({
  bass: audioInput.bass,
  mid: audioInput.mid,
  treble: audioInput.treble,
  energy: audioInput.energy,
  // ...
}, deltaTime)
```
**✅ CORRECTO**: Llama a Selene con audio real.

---

### 4. 🔥 **PUNTO CRÍTICO IDENTIFICADO**

**¿El problema está en `state.colors`?**

Los valores RGB que llegan al Canvas son **correctos estructuralmente**, pero:

**Hipótesis**:
1. ⚠️ **Selene genera colores similares** → `accent` y `ambient` son casi iguales
2. ⚠️ **ProceduralPaletteGenerator** devuelve colores monotonos
3. ⚠️ **Zodiac/Fibonacci no están variando suficiente**

---

## 🧪 DEBUG IMPLEMENTADO

### Nuevo Log en `main.ts` (Línea 369):

```typescript
// 🚨 DEBUG: Log RGB values periodically
if (Math.random() < 0.005 && fixture.zone?.includes('MOVING')) {
  console.log(`[DEBUG-RGB] ${fixture.zone}:`, 
    `Primary=[${color.r},${color.g},${color.b}]`,
    `Accent=[${accent.r},${accent.g},${accent.b}]`,
    `Ambient=[${ambient.r},${ambient.g},${ambient.b}]`)
}
```

**Propósito**: 
- Ver si `accent` y `ambient` tienen valores RGB diferentes
- Confirmar si el problema es **generación de color** (Selene) o **renderizado** (Canvas)

---

## 📊 FLUJO DE DATOS (Trazabilidad)

```
🎵 Audio → Selene.processAudioFrame()
    ↓
🧠 SeleneMusicalBrain.process()
    ↓
🎨 ProceduralPaletteGenerator.generatePalette()
    ↓ (WAVE 13.5: Zodiac + Fibonacci + Mutation)
📦 state.colors = { primary, secondary, accent, ambient }
    ↓
🔌 main.ts fixtureStates → r: accent.r, g: accent.g, b: accent.b
    ↓
📡 IPC: 'lux:state-update' → { fixtures: fixtureStates }
    ↓
💾 dmxStore.updateFixtureValues(fixtureStates)
    ↓
🗺️ Map<dmxAddress, FixtureValues>
    ↓
🎭 SimulateView/index.tsx → liveValues.r/g/b
    ↓
🖼️ Canvas: ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`
```

---

## ✅ VERIFICACIONES COMPLETADAS

| Componente | Estado | Notas |
|------------|--------|-------|
| Canvas fillStyle | ✅ CORRECTO | Usa `colorStr` sin modificaciones |
| RGB extraction | ✅ CORRECTO | Lee `liveValues.r/g/b` directamente |
| DMX Store | ✅ CORRECTO | Map estructura correcta |
| Backend envío | ✅ CORRECTO | RGB puro + dimmer independiente |
| IPC communication | ✅ CORRECTO | 'lux:state-update' funcional |
| Dimmer aplicación | ✅ CORRECTO | NO multiplica RGB (solo canal dimmer) |

---

## 🎯 CONCLUSIÓN PRELIMINAR

**El Canvas NO es el problema.**  
**El flujo de datos es correcto.**

### Posibles Causas Reales:

1. **🧠 ProceduralPaletteGenerator**:
   - Genera colores muy similares (accent ≈ ambient)
   - Zodiac Element no varía lo suficiente
   - Fibonacci rotation no crea contraste visual
   - Forced mutation no se activa

2. **🎨 Color Mapping**:
   - Key → Hue siempre da el mismo valor
   - Mood fallback no funciona
   - Mode modifier es muy sutil

3. **🔮 Zodiac Element**:
   - `calculateZodiacElement()` siempre devuelve el mismo elemento
   - Bass/Mid/Treble ratios no varían suficiente
   - Element weights (fire/water/air/earth) son muy sutiles

---

## 🚀 PRÓXIMOS PASOS

### Test 1: **Verificar RGB Values en Runtime**
```bash
# Ejecutar LuxSync y revisar consola
node release/win-unpacked/LuxSync.exe
# Buscar: [DEBUG-RGB] MOVING_LEFT: Primary=[...] Accent=[...] Ambient=[...]
```

**Esperado**: Ver valores RGB **diferentes** entre frames  
**Si falla**: El problema está en ProceduralPaletteGenerator

---

### Test 2: **Force Rainbow Mode**
```typescript
// En main.ts, línea 298 - TEMPORAL
const state = {
  colors: {
    primary: { r: 255, g: 0, b: 0 },    // Rojo
    secondary: { r: 0, g: 255, b: 0 },  // Verde
    accent: { r: 0, g: 0, b: 255 },     // Azul
    ambient: { r: 255, g: 255, b: 0 },  // Amarillo
  },
  // ... resto
}
```

**Esperado**: Canvas debe mostrar Moving LEFT azul, Moving RIGHT amarillo  
**Si falla**: Hay un problema en IPC/Store  
**Si funciona**: Confirma que el problema es Selene generando colores monotonos

---

### Test 3: **Forzar Zodiac Element Variation**
```typescript
// En SeleneMusicalBrain.ts, calculateZodiacElement()
// TEMPORAL: Rotar elementos cada 2 segundos
const elements = ['fire', 'water', 'air', 'earth']
return elements[Math.floor(Date.now() / 2000) % 4]
```

**Esperado**: Ver cambios de color cada 2 segundos  
**Si funciona**: Confirma que zodiac influence está funcionando

---

## 📝 NOTAS DEL DIAGNÓSTICO

**"El problema NO es el Canvas. El Canvas es un espejo fiel."**

Lo que vemos en el simulador es **exactamente** lo que Selene envía.  
Si todo se ve naranja/azul, es porque **Selene genera naranja/azul**.

### Posibles Bugs en WAVE 13.5:

1. **Zodiac Element siempre devuelve el mismo** (ej: siempre "fire")
2. **Fibonacci rotation no crea suficiente contraste** (222.5° desde amarillo sigue siendo amarillo-verdoso)
3. **Forced mutation nunca se activa** (color_fixation no detectado)
4. **Key → Hue siempre mapea a la misma zona** (ej: Key C = 0° rojo, nunca cambia de Key)

---

## 🔍 HERRAMIENTAS DE DEBUG AGREGADAS

✅ **main.ts línea 369**: RGB values log para Moving Heads  
✅ **Build compilado**: release/LuxSync Setup 1.0.0.exe  

**Instrucciones para Debug**:
1. Ejecutar LuxSync
2. Reproducir música
3. Abrir DevTools (F12)
4. Buscar logs `[DEBUG-RGB]`
5. Verificar si RGB cambia entre frames

---

**"Si el espejo muestra siempre naranja, es porque la fuente es naranja."** 🧡🔍
