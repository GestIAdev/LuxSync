# 🎯 QUICK REFERENCE - AUDITORÍA FORENSE RESUMIDA

**Generado:** 9 Enero 2026  
**Propósito:** Referencia rápida de hallazgos críticos

---

## 📍 PROBLEMA CRÍTICO #1: MIRROR DUPLICADO

### ¿Dónde?
```
FixtureMapper.ts línea 156-158
```

### ¿Qué?
```typescript
// ❌ ESTO ESTÁ MAL
if (zone === 'MOVING_RIGHT') {
  panValue = 1 - panValue  // Invierte SEGUNDA VEZ
}
```

### ¿Por qué es un problema?
```
HAL.applyPhaseOffset:  RIGHT pan = 0.5 + amp * (-1) = 0.38 ✓ (invertido)
              ↓
FixtureMapper:         if RIGHT { pan = 1 - 0.38 = 0.62 } ✗ (vuelve al original)
              ↓
Resultado:             MOVING_LEFT pan=0.62, MOVING_RIGHT pan=0.62 (IGUALES!)
                       ❌ No hay espejo visible
```

### ¿Cómo se arregla?
```
BORRAR líneas 156-158 de FixtureMapper.ts
Punto. Fin. Se acabó.
```

### ¿Qué evidencia tenemos?
- HAL logs muestran `mirrorSign=-1` para RIGHT (CORRECTO)
- HAL logs muestran `x=0.38` para RIGHT (CORRECTO)
- Pero pantalla muestra MOVING_LEFT = MOVING_RIGHT (INCORRECTO)
- Única explicación: se invierte dos veces

---

## 🧬 PROBLEMA ARQUITECTÓNICO #2: PATTERN MATH EN ENGINE

### ¿Dónde?
```
TitanEngine.ts línea ~760
```

### ¿Qué está hardcoded?
```typescript
case 'figure8':
  centerX = 0.5 + Math.sin(time * freq) * amplitude
  centerY = 0.5 + Math.cos(time * freq * 2) * amplitude
  return { centerX, centerY }

case 'circle':
  // Más código hardcoded...

case 'wave':
  // Más código hardcoded...

// ... etc
```

### ¿Por qué es un problema?
- TitanEngine es el orquestador principal
- No debería conocer detalles de cada patrón
- Cuando agrega un nuevo patrón, toca TitanEngine
- Cuando debuggea un patrón, busca en TitanEngine
- Todo mezclado en un archivo grande

### ¿La solución?
```
Crear VibeMovementManager.ts que centralice esto
(Refactoring arquitectónico, no urgente)
```

---

## ✅ LO QUE ESTÁ BIEN

| Sistema | Estado | Evidencia |
|---------|--------|-----------|
| **Latino Figure8** | ✅ Funciona | User confirmó 2D+3D |
| **Physics** | ✅ Correcto | SNAP MODE suave |
| **Rev Limiter** | ✅ Ubicación correcta | En PhysicsDriver, no en patterns |
| **Unit Flow** | ✅ Claro | 0-1 → 0-1 → 0-255 → 0-255 |

---

## ❌ LO QUE ESTÁ MAL

| Sistema | Estado | Severidad | Acción |
|---------|--------|-----------|--------|
| **Mirror (Techno)** | ❌ Roto | 🔴 CRÍTICA | Eliminar líneas 156-158 |
| **Pattern Separation** | ❌ Hardcoded | 🟠 IMPORTANTE | Crear VibeMovementManager |

---

## 🔬 RASTREO NUMÉRICO - MIRROR PATTERN

```
SCENARIO: Techno mirror, time=1.5s, speed=0.5, intensity=0.4

TitanEngine.calculateMovement('mirror'):
  centerX = 0.5 + sin(1.5*1) * 0.16 = 0.5 + 0.997*0.16 ≈ 0.659
  centerY = 0.5
  OUTPUT: { centerX: 0.659, centerY: 0.5 }

HAL.applyPhaseOffset('mirror', zone='MOVING_LEFT'):
  amplitudeX = 0.659 - 0.5 = 0.159
  mirrorSign = 1 (LEFT)
  x = 0.5 + 0.159 * 1 = 0.659 ✓
  OUTPUT: { x: 0.659, y: 0.5 }

HAL.applyPhaseOffset('mirror', zone='MOVING_RIGHT'):
  amplitudeX = 0.659 - 0.5 = 0.159
  mirrorSign = -1 (RIGHT)
  x = 0.5 + 0.159 * (-1) = 0.341 ✓ INVERTIDO
  OUTPUT: { x: 0.341, y: 0.5 }

FixtureMapper.mapFixture('MOVING_LEFT'):
  panValue = 0.659
  if (zone === 'MOVING_RIGHT') { /* NO APLICA */ }
  pan = round(0.659 * 255) = 168 DMX ✓
  OUTPUT: { pan: 168 DMX }

FixtureMapper.mapFixture('MOVING_RIGHT'):
  panValue = 0.341
  if (zone === 'MOVING_RIGHT') { panValue = 1 - 0.341 = 0.659 } ✗ BUG!
  pan = round(0.659 * 255) = 168 DMX ✓ (pero debería ser 87!)
  OUTPUT: { pan: 168 DMX } ← IGUAL QUE LEFT!

RESULTADO FINAL:
  LEFT:  pan = 168 DMX ≈ +33° (derecha)
  RIGHT: pan = 168 DMX ≈ +33° (derecha) ← ¡DEBERÍA SER -33°!
  
  ❌ NO EXISTE ESPEJO - AMBOS VEN LO MISMO
```

---

## 📊 COMPARATIVA ANTES vs DESPUÉS

### ANTES (Actual - Roto)
```
Techno Mirror Test:
┌─────────────────────────────────────────┐
│ MOVING_LEFT:  Pan = +45°                │  Ambos apuntan
│ MOVING_RIGHT: Pan = +45°                │  al MISMO lado!
│                                         │
│ ❌ No hay "puertas del infierno"        │
└─────────────────────────────────────────┘
```

### DESPUÉS (Post-Fix)
```
Techno Mirror Test:
┌─────────────────────────────────────────┐
│ MOVING_LEFT:  Pan = +45°                │  Espejo perfecto
│ MOVING_RIGHT: Pan = -45°                │  "Puertas abriéndose"
│                                         │
│ ✅ Efecto visual correcto                │
└─────────────────────────────────────────┘
```

---

## 🔍 CÓMO DEBUGGEAR

### Activar logs detallados (DevTools)
```javascript
// En consola del navegador (F12):
// Los logs ya están en el código, solo observar:

[🪞 MIRROR] Fixture 0 | Zone: "MOVING_LEFT" | Sign=1 | baseX=0.659 → x=0.659
[🪞 MIRROR] Fixture 1 | Zone: "MOVING_RIGHT" | Sign=-1 | baseX=0.659 → x=0.341

// ANTES del fix: ambos x=0.659
// DESPUÉS del fix: x=0.659 vs x=0.341 (diferentes)
```

### Verificar visualmente
```
1. Ir a Techno
2. Activar "mirror" pattern
3. Observar pan de MOVING_LEFT y MOVING_RIGHT
4. Deben apuntar en DIRECCIONES OPUESTAS
5. El efecto se llama "puertas del infierno" (opening doors)
```

---

## 🛠️ STACK TÉCNICO

| Capa | Archivo | Línea | Responsabilidad |
|------|---------|-------|-----------------|
| 1. Pattern Gen | TitanEngine.ts | ~760 | Generar trayectoria base |
| 2. Phase Offset | HardwareAbstraction.ts | 177 | Desfasar per-fixture |
| 3. **BUGGY** | **FixtureMapper.ts** | **156** | Mapear a DMX |
| 4. Physics | FixturePhysicsDriver.ts | 420 | Interpolar con límites |
| 5. Output | HAL.render() | 619 | Enviar a hardware |

---

## 📝 DOCUMENTOS RELACIONADOS

- **FORENSIC-MOVEMENT.md** - Análisis completo, 400+ líneas
- **EXECUTION-PLAYBOOK.md** - Guía paso a paso de fixes
- **Este archivo** - Quick reference

---

## ⏱️ TIEMPO ESTIMADO

| Operación | Tiempo | Riesgo |
|-----------|--------|--------|
| Mirror Fix | 5 min | ✅ Bajo |
| Test | 2 min | ✅ Bajo |
| Compilar | 3 min | ✅ Bajo |
| Visual test | 2 min | ✅ Bajo |
| **TOTAL** | **~12 min** | **✅ Bajo** |

---

## 🎯 TODO PARA RADWULF

```
[ ] Abre FixtureMapper.ts
[ ] Ve a línea 156
[ ] Selecciona las 3 líneas:
    // Mirror effect for MOVING_RIGHT
    if (zone === 'MOVING_RIGHT') {
      panValue = 1 - panValue
    }
[ ] Presiona Delete
[ ] Guarda (Ctrl+S)
[ ] npm run build
[ ] Abre app y prueba Techno mirror
[ ] Verifica que MOVING_LEFT ≠ MOVING_RIGHT
[ ] ✅ Listo!
```

---

**Estado:** LISTO PARA EJECUCIÓN  
**Riesgo:** MÍNIMO  
**Impacto:** MÁXIMO
