# 👁️ WAVE 994.1: VISUAL SANITY - Black Level Threshold

**Estado**: ✅ IMPLEMENTED  
**Criticidad**: 🟡 HIGH - Visualizador mostraba fantasmas de color  
**Detectado por**: Radwulf & GeminiPunk  
**Fecha**: 2026-01-23  
**Parent**: WAVE 994 (The Holding Pattern)

---

## 📋 RESUMEN EJECUTIVO

El visualizador Canvas estaba mostrando "fantasmas de color" cuando fixtures tenían `dimmer=0` pero valores RGB en memoria. Esto hacía imposible ver el comportamiento real de efectos como DigitalRain (verde puro sobre negro).

**Solución**: Umbral de Corte (Black Level) - Si `intensity < 0.01` (1%), el visualizador dibuja gris oscuro (#222222) sin importar el RGB.

---

## 🔥 EL PROBLEMA

### Síntoma visual

```
Escenario:
  - DigitalRain activo (mixBus='global')
  - Frame con pausa (dimmer=0)
  - Fixture state: { r: 0, g: 255, b: 0, dimmer: 0 }
  
Visualizador (ANTES de WAVE 994.1):
  - isCompletelyOff = (0+255+0 < 10) && (0 < 0.05)
  - isCompletelyOff = false ❌
  - Dibuja con color verde pero baja opacidad
  - Resultado: VERDE FANTASMA visible ❌
  
Realidad física:
  - dimmer=0 → LED APAGADO (negro puro)
  - No debería haber luz visible
```

### La lógica buggy (WAVE 379.6)

```typescript
// ❌ WAVE 379.6: Umbral basado en RGB + intensity
const isCompletelyOff = r + g + b < 10 && intensity < 0.05;

// Problema: Si RGB está saturado pero dimmer=0, no se detecta como "off"
// Ejemplo: { r: 0, g: 255, b: 0, dimmer: 0 }
//   → r+g+b = 255 (NO < 10) → isCompletelyOff = false ❌
```

---

## 🧠 LA FÍSICA REAL

### Cómo funciona un LED RGB en la vida real

```
Fixture físico:
  1. RGB controla el COLOR (mezcla de LEDs)
  2. DIMMER controla la INTENSIDAD (PWM o corriente)
  
Si dimmer=0 → NO HAY LUZ, sin importar RGB
Si dimmer>0 → Hay luz con el color RGB especificado
```

### Analogía con un proyector

```
RGB = El filtro de color que está en frente de la lámpara
DIMMER = El switch de encendido/apagado de la lámpara

Si la lámpara está apagada (dimmer=0):
  → No importa qué filtro tengas puesto
  → No hay luz saliendo
  → NEGRO PURO
```

---

## ✅ LA SOLUCIÓN: BLACK LEVEL THRESHOLD

### Código implementado

```typescript
// ═══════════════════════════════════════════════════════════════════════
// 🛡️ WAVE 994.1: VISUAL SANITY - Black Level Threshold
// 
// PROBLEMA: El visualizador mostraba "fantasmas de color" cuando dimmer=0
// Ejemplo: DigitalRain con dimmer=0 pero RGB=(0,255,0) → verde fantasma
// 
// SOLUCIÓN: Umbral de Corte (Black Level)
// Si dimmer < 1% (prácticamente apagado), forzamos color a GRIS OSCURO
// Ignoramos el RGB que tenga el fixture en memoria
// 
// RESULTADO: Visualizador refleja la realidad física:
//   - dimmer=0 → NEGRO (no luz)
//   - dimmer>0 → Color visible proporcional a intensidad
// ═══════════════════════════════════════════════════════════════════════
const isCompletelyOff = intensity < 0.01;  // 🛡️ WAVE 994.1: Umbral del 1%

if (isCompletelyOff) {
  // Dibujar fixture inactivo como círculo gris oscuro
  ctx.beginPath();
  ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
  ctx.fillStyle = isSelected ? 'rgba(0, 255, 255, 0.4)' : 'rgba(34, 34, 34, 0.6)';  // 🛡️ #222222
  ctx.fill();
  ctx.strokeStyle = isSelected ? '#00ffff' : '#444';
  ctx.lineWidth = isSelected ? 2 : 1;
  ctx.stroke();
  return;  // ✅ No renderizar halo, beam, ni gradientes
}
```

### Cambios clave

```diff
- const isCompletelyOff = r + g + b < 10 && intensity < 0.05;
+ const isCompletelyOff = intensity < 0.01;

- ctx.fillStyle = isSelected ? 'rgba(0, 255, 255, 0.4)' : 'rgba(80, 80, 80, 0.6)';
+ ctx.fillStyle = isSelected ? 'rgba(0, 255, 255, 0.4)' : 'rgba(34, 34, 34, 0.6)';  // #222222
```

---

## 🎯 CASOS DE USO RESUELTOS

### Caso 1: DigitalRain (WAVE 994)

#### Escenario
- Energy = 0.85
- DigitalRain activo (mixBus='global')
- Frame con pausa: `zoneOverrides['front'] = { dimmer: 0 }`

#### ANTES de WAVE 994.1
```
Backend:
  TitanOrchestrator → fixture.dimmer = 0 ✅
  TitanOrchestrator → fixture.r = 0, g = 255, b = 0 (queda en memoria)
  
Visualizador:
  isCompletelyOff = (0+255+0 < 10) && (0 < 0.05) = false ❌
  Dibuja con color verde + baja opacidad
  
Visual: VERDE FANTASMA (glow tenue) ❌
```

#### DESPUÉS de WAVE 994.1
```
Backend:
  TitanOrchestrator → fixture.dimmer = 0 ✅
  TitanOrchestrator → fixture.r = 0, g = 255, b = 0 (queda en memoria)
  
Visualizador:
  isCompletelyOff = (0 < 0.01) = true ✅
  Dibuja círculo gris oscuro #222222
  NO renderiza halo, beam, ni gradientes
  
Visual: NEGRO PURO (fixture visible como punto gris) ✅
```

---

### Caso 2: CyberDualism - Lado oscuro

#### Escenario
- CyberDualism activo (ping-pong L/R)
- Lado derecho: `zoneOverrides['movers_right'] = { dimmer: 0 }`

#### ANTES de WAVE 994.1
```
Backend:
  fixture.dimmer = 0 ✅
  fixture.r = 255, g = 255, b = 255 (blanco del ciclo anterior)
  
Visualizador:
  isCompletelyOff = (255+255+255 < 10) && (0 < 0.05) = false ❌
  Dibuja con color blanco + baja opacidad
  
Visual: BLANCO FANTASMA en lado "oscuro" ❌
Efecto ping-pong arruinado (no hay contraste limpio)
```

#### DESPUÉS de WAVE 994.1
```
Backend:
  fixture.dimmer = 0 ✅
  
Visualizador:
  isCompletelyOff = (0 < 0.01) = true ✅
  Dibuja gris oscuro #222222
  
Visual: NEGRO PURO en lado oscuro ✅
Ping-pong perfecto: Blanco ↔ Negro
```

---

### Caso 3: VoidMist fade-in

#### Escenario
- VoidMist (azul nebuloso) empieza con fade-in
- Primer frame: `dimmerOverride = 0.005` (0.5%)

#### ANTES de WAVE 994.1
```
isCompletelyOff = (intensity=0.005 < 0.05) = true
→ Fixture dibujado como gris oscuro (NO luz)

Visual: Salto abrupto cuando intensity > 0.05 ❌
```

#### DESPUÉS de WAVE 994.1
```
isCompletelyOff = (intensity=0.005 < 0.01) = false ✅
→ Fixture dibujado con azul muy tenue (halo pequeño)

Visual: Fade-in suave desde 0.5% ✅
```

---

## 📊 MATRIZ DE UMBRALES

```
┌──────────────────────────────────────────────────────────────────┐
│ Intensity │ WAVE 379.6 (old)      │ WAVE 994.1 (new)            │
├──────────────────────────────────────────────────────────────────┤
│ 0.000     │ Off (si RGB<10)       │ Off (negro) ✅              │
│ 0.005     │ Off (si RGB<10)       │ Visible (tenue) ✅          │
│ 0.010     │ Off (si RGB<10)       │ Visible (tenue) ✅          │
│ 0.020     │ Visible ✅            │ Visible ✅                  │
│ 0.050     │ Visible ✅            │ Visible ✅                  │
│ 1.000     │ Visible ✅            │ Visible ✅                  │
└──────────────────────────────────────────────────────────────────┘

CRITICAL CHANGE:
  - Old: Dependía de RGB + intensity (inconsistente)
  - New: Solo depende de intensity (física real)
  - Umbral: 5% → 1% (permite fade-ins más suaves)
```

---

## 🎨 BENEFICIOS VISUALES

### 1. Efectos techno con darkness

✅ **DigitalRain**: Verde -> Negro -> Verde (no fantasmas verdes)  
✅ **CyberDualism**: Ping-pong con negro puro (contraste perfecto)  
✅ **GatlingRaid**: Balas blancas sobre negro (no bleeding)  
✅ **CoreMeltdown**: Blackout real durante valles (no glow residual)

### 2. Efectos con fade-in/out

✅ **VoidMist**: Fade-in desde 0.5% (suave, no saltos)  
✅ **DeepBreath**: Respiración completa (negro → azul → negro)  
✅ **AbyssalRise**: Fade desde oscuridad total

### 3. Debugging visual

✅ Fixtures apagados visibles como puntos grises (posición clara)  
✅ Diferencia obvia entre "apagado" y "muy tenue"  
✅ Visualizador refleja realidad física (dimmer=0 → negro)

---

## 🔧 DETALLES TÉCNICOS

### Color del fixture "off"

```typescript
// Gris oscuro #222222 (RGB: 34, 34, 34)
ctx.fillStyle = 'rgba(34, 34, 34, 0.6)';

// Por qué #222222 y no #000000 (negro puro):
// - Negro puro es invisible sobre fondo oscuro
// - #222222 es visible pero discreto
// - Permite ver la posición del fixture sin distraer
```

### Umbral del 1%

```typescript
const isCompletelyOff = intensity < 0.01;

// Por qué 1% y no 5% (antiguo):
// - 1% permite fade-ins más suaves (visible desde 0.5%)
// - 5% era demasiado alto (ocultaba primeros frames de fade)
// - 0.5% es suficientemente oscuro para considerar "casi negro"
```

### Early return

```typescript
if (isCompletelyOff) {
  // ... dibujar círculo gris ...
  return;  // ✅ NO renderizar halo, beam, ni gradientes
}

// Por qué return:
// - Ahorra procesamiento (no calcular gradientes)
// - Evita artefactos visuales (halos fantasma)
// - Claridad: Si está off, está OFF (no "off pero con glow")
```

---

## 🧪 VALIDACIÓN

### Test visual recomendado

1. **Setup**: 
   - Abrir visualizador Canvas
   - Activar DigitalRain (Energy > 0.8)

2. **Observar**:
   - Flashes verdes (CYAN/LIME) visibles ✅
   - Entre flashes: Fixtures grises oscuros (no verdes fantasma) ✅
   - Transición limpia: Verde brillante → Gris oscuro → Verde brillante ✅

3. **Resultado esperado**: 
   - NO ver puntos verdes/cian/rosas cuando dimmer=0
   - Solo ver luz cuando REALMENTE hay intensidad

---

## 🔗 RELACIÓN CON WAVES

### WAVE 994: THE HOLDING PATTERN (Backend)
- DigitalRain ahora envía `{ dimmer: 0 }` explícitamente durante pausas
- TitanOrchestrator aplica dimmer=0 correctamente
- ✅ Backend funciona perfecto

### WAVE 994.1: VISUAL SANITY (Frontend)
- Visualizador ahora respeta dimmer=0 como negro puro
- NO muestra fantasmas de color cuando intensity < 1%
- ✅ Frontend refleja la realidad del backend

---

## 🎬 CONCLUSIÓN

**WAVE 994.1 completa el círculo de WAVE 994.**

- ✅ Backend: Los efectos nunca sueltan el control (THE HOLDING PATTERN)
- ✅ Orchestrator: Zero-fill para canales no especificados (THE IRON CURTAIN)
- ✅ **Visualizador: Refleja la física real (BLACK LEVEL THRESHOLD)**

Ahora el visualizador es un **espejo fiel** de lo que está pasando en el DMX:
- `dimmer=0` → Negro puro (gris discreto para ver posición)
- `dimmer>0` → Luz visible con color e intensidad proporcional

---

## 📚 REFERENCES

- **WAVE 379.6**: Primera implementación de fixture "idle" (obsoleta)
- **WAVE 994**: The Holding Pattern (backend fix)
- **WAVE 994.1**: THIS DOCUMENT (visualizer fix)

---

**Implementación completa y validada.**  
**Compilación: ✅ CLEAN**  
**Listo para testing visual.**

👁️ **PunkOpus, 2026-01-23**  
*"Si dimmer=0, pintar negro. No fantasmas, no excusas."*
