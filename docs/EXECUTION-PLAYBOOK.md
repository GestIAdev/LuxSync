# 🔧 PLAYBOOK DE EJECUCIÓN - FIXES INMEDIATOS

**Radwulf,** esto es tu guía paso a paso para arreglar el sistema.

---

## OPERACIÓN 1: 🪞 MATAR EL MIRROR DUPLICADO (5 MIN)

### El Problema en 3 Líneas
- HAL invierte RIGHT correctamente
- FixtureMapper invierte de nuevo
- Resultado: Doble flip = sin cambio

### El Fix

**Archivo:** `electron-app/src/hal/mapping/FixtureMapper.ts`  
**Líneas:** 156-158

**ANTES:**
```typescript
    // Mirror effect for MOVING_RIGHT
    if (zone === 'MOVING_RIGHT') {
      panValue = 1 - panValue
    }
    
    // Ceiling tilt inversion (WAVE 24.6)
```

**DESPUÉS:**
```typescript
    // Ceiling tilt inversion (WAVE 24.6)
```

### Verificación Post-Fix

1. Compilar:
   ```powershell
   cd electron-app
   npm run build
   ```

2. Ejecutar:
   ```powershell
   npm run dev
   ```

3. Test visual Techno mirror:
   - MOVING_LEFT debe apuntar a la DERECHA (pan ~+45°)
   - MOVING_RIGHT debe apuntar a la IZQUIERDA (pan ~-45°)
   - Deben ser ESPEJO uno del otro

4. Verificar logs (F12 DevTools):
   ```
   [🪞 MIRROR] Fixture 0 | Zone: "MOVING_LEFT" | Sign=1 | ... → x=0.62
   [🪞 MIRROR] Fixture 1 | Zone: "MOVING_RIGHT" | Sign=-1 | ... → x=0.38
   ```
   Los valores de salida (x) deben ser diferentes

---

## OPERACIÓN 2: 🧠 CREAR VIBEMOVEMENTMANAGER (2 HORAS)

### Paso 1: Crear Archivo Base

**Archivo nuevo:** `electron-app/src/core/VibeMovementManager.ts`

```typescript
/**
 * 🎯 VibeMovementManager
 * 
 * Responsabilidad: Centralizar generación de patrones de movimiento
 * Beneficio: Separación de concerns, testeable, escalable
 * 
 * Nota: TitanEngine NO debe conocer matemática de patrones
 */

export interface PatternResult {
  centerX: number
  centerY: number
}

export class VibeMovementManager {
  /**
   * Generar patrón de movimiento base (sin phase offset)
   * 
   * @param pattern Tipo de patrón (figure8, circle, wave, etc)
   * @param time Tiempo en segundos desde inicio del patrón
   * @param speed Factor de velocidad (0.1 a 1.0)
   * @param intensity Amplitud del movimiento (0.0 a 1.0)
   * @returns Posición {centerX, centerY} en escala 0-1
   */
  static generatePattern(
    pattern: string,
    time: number,
    speed: number,
    intensity: number
  ): PatternResult {
    const handler = this.PATTERN_HANDLERS[pattern]
    if (!handler) {
      console.warn(`[⚠️ PATTERN] Unknown pattern: ${pattern}, defaulting to static`)
      return this.static(time, speed, intensity)
    }
    return handler.call(this, time, speed, intensity)
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🎯 PATTERN IMPLEMENTATIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * 💃 FIGURE8 - Patrón en forma de 8
   * Movimiento lateral Y vertical con frecuencias diferentes
   * Usado en: LATINO
   */
  private static figure8(time: number, speed: number, intensity: number): PatternResult {
    const freq = speed * 2  // Convertir speed (0-1) a Hz
    const amplitude = intensity * 0.4  // Max 40% del rango
    
    // El "8" se hace con diferentes frecuencias en X e Y
    const centerX = 0.5 + Math.sin(time * freq) * amplitude
    const centerY = 0.5 + Math.cos(time * freq * 2) * amplitude  // Doblar frecuencia en Y
    
    return { centerX, centerY }
  }

  /**
   * 💫 CIRCLE - Patrón circular
   * Movimiento suave alrededor del centro
   * Usado en: LATINO (variante)
   */
  private static circle(time: number, speed: number, intensity: number): PatternResult {
    const freq = speed * 2
    const amplitude = intensity * 0.4
    
    // Círculo perfecto: misma frecuencia en X e Y
    const centerX = 0.5 + Math.sin(time * freq) * amplitude
    const centerY = 0.5 + Math.cos(time * freq) * amplitude
    
    return { centerX, centerY }
  }

  /**
   * 🌊 WAVE - Patrón ondulante
   * Movimiento lateral con respiración vertical
   * Usado en: LATINO (variante)
   */
  private static wave(time: number, speed: number, intensity: number): PatternResult {
    const freq = speed * 2
    const amplitude = intensity * 0.4
    
    // Onda: pan oscila, tilt sube/baja suavemente
    const centerX = 0.5 + Math.sin(time * freq) * amplitude
    const centerY = 0.5 + Math.sin(time * freq * 0.5) * (amplitude * 0.5)  // Menos movimiento vertical
    
    return { centerX, centerY }
  }

  /**
   * 🏃 SWEEP - Barrido lineal
   * Movimiento de izq a der (o arr a ab)
   * Usado en: LATINO (variante)
   */
  private static sweep(time: number, speed: number, intensity: number): PatternResult {
    const freq = speed * 2
    const amplitude = intensity * 0.4
    
    // Barrido: pan oscila entre izq y der, tilt estático
    const centerX = 0.5 + Math.sin(time * freq) * amplitude
    const centerY = 0.5
    
    return { centerX, centerY }
  }

  /**
   * 🪞 MIRROR - Puertas del infierno
   * Patrón base estático (el offset lo hace applyPhaseOffset en HAL)
   * Usado en: TECHNO
   * 
   * ℹ️ Nota: El espejo se aplica en HAL.applyPhaseOffset() por zona
   *          Esta función solo devuelve el center (búsqueda estática)
   */
  private static mirror(time: number, speed: number, intensity: number): PatternResult {
    // Mirror NO genera pattern math
    // Devuelve center fijo + amplitude (la búsqueda)
    // El offset y la inversión LEFT/RIGHT se hacen en HAL
    const amplitude = intensity * 0.3
    const centerX = 0.5 + Math.sin(time * speed * 0.5) * amplitude
    const centerY = 0.5
    
    return { centerX, centerY }
  }

  /**
   * 🏃 CHASE - Persecución láser
   * Movimiento rápido de lado a lado
   * Usado en: TECHNO (variante)
   * 
   * ℹ️ El efecto "persecución" se crea en HAL.applyPhaseOffset()
   *    donde cada fixture recibe un chasePhase diferente
   */
  private static chase(time: number, speed: number, intensity: number): PatternResult {
    // Chase también devuelve center estático
    // El offset lo hace applyPhaseOffset con chasePhase
    const amplitude = intensity * 0.4
    const centerX = 0.5 + Math.sin(time * speed * 2) * amplitude
    const centerY = 0.5
    
    return { centerX, centerY }
  }

  /**
   * 🧘 STATIC - Punto fijo con respiración sutil
   * Movimiento mínimo, enfoque en intensidad
   * Usado en: CHILL, quieto
   */
  private static static(time: number, speed: number, intensity: number): PatternResult {
    // Static: punto fijo, pero con respiración muy sutil
    const centerX = 0.5
    const centerY = 0.5 + Math.sin(time * 0.5) * 0.02  // Respira ~2% del rango
    
    return { centerX, centerY }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🔧 MAPPING DE PATRONES
  // ═══════════════════════════════════════════════════════════════════

  private static readonly PATTERN_HANDLERS: {
    [key: string]: (time: number, speed: number, intensity: number) => PatternResult
  } = {
    'figure8': VibeMovementManager.figure8,
    'circle': VibeMovementManager.circle,
    'wave': VibeMovementManager.wave,
    'sweep': VibeMovementManager.sweep,
    'mirror': VibeMovementManager.mirror,
    'chase': VibeMovementManager.chase,
    'static': VibeMovementManager.static,
  }
}
```

### Paso 2: Refactorizar TitanEngine

**Archivo:** `electron-app/src/core/TitanEngine.ts`

Buscar la función `calculateMovement`:

**ANTES (línea ~760):**
```typescript
private calculateMovement(intent: LightingIntent, deltaTime: number) {
  const pattern = intent.movement?.pattern || 'static'
  const speed = intent.movement?.speed || 0.5
  const freq = ...
  const time = this.movementTime
  const amplitude = ...
  
  switch (pattern) {
    case 'figure8':
      const centerX = 0.5 + Math.sin(time * freq) * amplitude
      const centerY = 0.5 + Math.cos(time * freq * 2) * amplitude
      return { centerX, centerY }
    
    case 'circle':
      // ... más código hardcoded
    
    // ... etc
  }
}
```

**DESPUÉS:**
```typescript
private calculateMovement(intent: LightingIntent, deltaTime: number) {
  const pattern = intent.movement?.pattern || 'static'
  const speed = intent.movement?.speed || 0.5
  const intensity = intent.movement?.intensity || 0.5
  const time = this.movementTime
  
  // Delegar a VibeMovementManager
  return VibeMovementManager.generatePattern(pattern, time, speed, intensity)
}
```

### Paso 3: Agregar Import

Al principio de `TitanEngine.ts`:
```typescript
import { VibeMovementManager } from './VibeMovementManager'
```

### Paso 4: Compilar y Testear

```powershell
npm run build
npm run dev
```

Verificar que Latino sigue funcionando (no debería haber cambios visuales).

---

## OPERACIÓN 3: 📝 CREAR TEST SUITE (1 HORA)

### Paso 1: Crear Archivo de Tests

**Archivo nuevo:** `electron-app/src/core/__tests__/VibeMovementManager.test.ts`

```typescript
import { VibeMovementManager } from '../VibeMovementManager'

describe('VibeMovementManager', () => {
  
  describe('figure8 pattern', () => {
    it('should generate valid coordinates in 0-1 range', () => {
      const result = VibeMovementManager.generatePattern('figure8', 0, 0.5, 0.5)
      
      expect(result.centerX).toBeGreaterThanOrEqual(0)
      expect(result.centerX).toBeLessThanOrEqual(1)
      expect(result.centerY).toBeGreaterThanOrEqual(0)
      expect(result.centerY).toBeLessThanOrEqual(1)
    })

    it('should return center when speed/intensity are 0', () => {
      const result = VibeMovementManager.generatePattern('figure8', 100, 0, 0)
      
      expect(result.centerX).toBe(0.5)
      expect(result.centerY).toBe(0.5)
    })

    it('should differ from circle pattern (different frequencies)', () => {
      const time = 2.5
      const figure8 = VibeMovementManager.generatePattern('figure8', time, 0.5, 0.5)
      const circle = VibeMovementManager.generatePattern('circle', time, 0.5, 0.5)
      
      // Figure8 tiene diferentes frecuencias en X/Y, circle no
      expect(Math.abs(figure8.centerY - circle.centerY)).toBeGreaterThan(0.01)
    })
  })

  describe('circle pattern', () => {
    it('should maintain equal frequency in X and Y', () => {
      const times = [0, 0.5, 1.0, 1.5, 2.0]
      const points = times.map(t => 
        VibeMovementManager.generatePattern('circle', t, 0.5, 0.5)
      )
      
      // En un círculo, amplitudes deberían ser similares en X e Y
      points.forEach(p => {
        const distX = Math.abs(p.centerX - 0.5)
        const distY = Math.abs(p.centerY - 0.5)
        expect(Math.abs(distX - distY)).toBeLessThan(0.05)
      })
    })
  })

  describe('static pattern', () => {
    it('should keep X constant', () => {
      const times = [0, 1, 2, 3]
      const xs = times.map(t => 
        VibeMovementManager.generatePattern('static', t, 0.5, 0.5).centerX
      )
      
      xs.forEach(x => {
        expect(x).toBe(0.5)
      })
    })

    it('should have minimal Y variation', () => {
      const times = [0, 0.5, 1.0, 1.5, 2.0]
      const ys = times.map(t => 
        VibeMovementManager.generatePattern('static', t, 0.5, 0.5).centerY
      )
      
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      const range = maxY - minY
      
      expect(range).toBeLessThan(0.05)  // Máximo 5% de rango
    })
  })

  describe('speed parameter', () => {
    it('should increase frequency with speed', () => {
      const slowTime = 1.0
      const fast = VibeMovementManager.generatePattern('figure8', slowTime, 1.0, 0.5)
      const slow = VibeMovementManager.generatePattern('figure8', slowTime, 0.1, 0.5)
      
      // Mayor speed = más oscilaciones en el mismo tiempo
      // Esto se refleja en diferentes posiciones
      expect(Math.abs(fast.centerX - slow.centerX)).toBeGreaterThan(0.1)
    })
  })

  describe('intensity parameter', () => {
    it('should increase amplitude with intensity', () => {
      const time = 0.5
      const intense = VibeMovementManager.generatePattern('figure8', time, 0.5, 1.0)
      const subtle = VibeMovementManager.generatePattern('figure8', time, 0.5, 0.0)
      
      const distIntense = Math.sqrt(
        Math.pow(intense.centerX - 0.5, 2) + 
        Math.pow(intense.centerY - 0.5, 2)
      )
      const distSubtle = Math.sqrt(
        Math.pow(subtle.centerX - 0.5, 2) + 
        Math.pow(subtle.centerY - 0.5, 2)
      )
      
      expect(distIntense).toBeGreaterThan(distSubtle)
    })
  })

  describe('default fallback', () => {
    it('should fallback to static for unknown pattern', () => {
      const result = VibeMovementManager.generatePattern('unknown_pattern', 1.0, 0.5, 0.5)
      
      expect(result.centerX).toBe(0.5)
      expect(result.centerY).toBeLessThanOrEqual(0.52)  // Static respira un poco
    })
  })
})
```

### Paso 2: Agregar Test para Mirror Fix

**Archivo nuevo:** `electron-app/src/hal/__tests__/MirrorFix.test.ts`

```typescript
import { HardwareAbstraction } from '../HardwareAbstraction'
import { FixtureMapper } from '../mapping/FixtureMapper'

describe('Mirror Pattern Fix - WAVE 343', () => {
  let hal: HardwareAbstraction
  let mapper: FixtureMapper

  beforeEach(() => {
    // Setup
    hal = new HardwareAbstraction()
    mapper = new FixtureMapper('floor')
  })

  describe('applyPhaseOffset - mirror pattern', () => {
    it('should invert RIGHT zone but not LEFT zone', () => {
      const baseX = 0.65  // Posición a la derecha del centro
      const baseY = 0.5
      
      const left = hal['applyPhaseOffset'](
        baseX, baseY, 'mirror', 0, 'MOVING_LEFT', 0, 120
      )
      
      const right = hal['applyPhaseOffset'](
        baseX, baseY, 'mirror', 1, 'MOVING_RIGHT', 0, 120
      )
      
      // LEFT debe mantener la posición
      expect(left.x).toBeCloseTo(0.65, 2)
      
      // RIGHT debe estar invertido alrededor del centro
      expect(right.x).toBeCloseTo(0.35, 2)
      
      // No deben ser iguales
      expect(Math.abs(left.x - right.x)).toBeGreaterThan(0.2)
    })
  })

  describe('mapFixture - NO double inversion', () => {
    it('should NOT apply mirror twice', () => {
      const fixture = {
        zone: 'MOVING_RIGHT',
        type: 'moving',
        id: 'mover-1'
      }
      
      const movement = {
        pan: 0.35,  // Ya invertido por HAL
        tilt: 0.5
      }
      
      const state = mapper.mapFixture(fixture, {}, 1.0, movement)
      
      // FixtureMapper debería conservar el valor que recibe
      // NO debería invertir de nuevo
      const expectedPan = Math.round(0.35 * 255)
      
      expect(state.pan).toBe(expectedPan)
      expect(state.pan).not.toBe(Math.round(0.65 * 255))  // No debería volver al original
    })
  })

  describe('Full flow - mirror pattern', () => {
    it('MOVING_LEFT and MOVING_RIGHT should be mirror of each other', () => {
      // Simular patrón mirror a través de todo el flujo
      
      const amplitude = 0.1
      const leftBaseX = 0.5 + amplitude
      const rightBaseX = 0.5 + amplitude
      
      // Step 1: HAL.applyPhaseOffset
      const leftAfterPhase = hal['applyPhaseOffset'](
        leftBaseX, 0.5, 'mirror', 0, 'MOVING_LEFT', 0, 120
      )
      
      const rightAfterPhase = hal['applyPhaseOffset'](
        rightBaseX, 0.5, 'mirror', 1, 'MOVING_RIGHT', 0, 120
      )
      
      // Step 2: FixtureMapper (debería NO cambiar)
      const leftFixture = {
        zone: 'MOVING_LEFT',
        type: 'moving',
        id: 'left-1'
      }
      
      const rightFixture = {
        zone: 'MOVING_RIGHT',
        type: 'moving',
        id: 'right-1'
      }
      
      const leftState = mapper.mapFixture(leftFixture, {}, 1.0, leftAfterPhase)
      const rightState = mapper.mapFixture(rightFixture, {}, 1.0, rightAfterPhase)
      
      // FINAL: Deben ser espejo uno del otro
      expect(leftState.pan).not.toBe(rightState.pan)
      
      // La suma debe ser ~255 (espejo perfecto en rango DMX)
      expect(Math.abs(leftState.pan + rightState.pan - 255)).toBeLessThan(5)
    })
  })
})
```

### Paso 3: Correr Tests

```powershell
npm test
```

Todos los tests deberían pasar después del fix de mirror.

---

## CRONOGRAMA ESTIMADO

```
┌─ OPERACIÓN 1: Mirror Fix ────────────────────┐
│ Tiempo: 5 min                                 │
│ Riesgo: Bajo (una línea)                     │
│ Impacto: Alto (Techno funciona)              │
├────────────────────────────────────────────────┤
│ Pasos:                                         │
│ 1. Eliminar líneas 156-158 en FixtureMapper   │
│ 2. npm run build                              │
│ 3. npm run dev                                │
│ 4. Visual test Techno mirror                  │
└────────────────────────────────────────────────┘

┌─ OPERACIÓN 2: VibeMovementManager ────────────┐
│ Tiempo: 2 horas                               │
│ Riesgo: Medio (refactoring)                  │
│ Impacto: Arquitectónico                       │
├────────────────────────────────────────────────┤
│ Pasos:                                         │
│ 1. Crear VibeMovementManager.ts               │
│ 2. Copiar pattern logic de TitanEngine        │
│ 3. Refactorizar TitanEngine.calculateMovement│
│ 4. npm run build                              │
│ 5. Visual test todos los patrones             │
│ 6. Verificar logs (no debería cambiar)        │
└────────────────────────────────────────────────┘

┌─ OPERACIÓN 3: Test Suite ────────────────────┐
│ Tiempo: 1 hora                                │
│ Riesgo: Bajo (solo tests)                    │
│ Impacto: Prevención de regressions            │
├────────────────────────────────────────────────┤
│ Pasos:                                         │
│ 1. Crear VibeMovementManager.test.ts          │
│ 2. Crear MirrorFix.test.ts                    │
│ 3. npm test                                   │
│ 4. Todos los tests verdes                     │
└────────────────────────────────────────────────┘

TOTAL: ~3.5 horas de trabajo
```

---

## 🚨 POTENCIAL DE ERRORES

| Riesgo | Síntoma | Solución |
|--------|---------|----------|
| **FixtureMapper se rompe** | Techno se ve peor | La línea que borramos era el problema, NO la solución |
| **TitanEngine falla** | Patrones no se generan | Verificar que VibeMovementManager se importe correctamente |
| **Tests fallan después del refactoring** | Build error | Revisar imports en TitanEngine |
| **Latino se rompe** | Figure8 se ve distinto | No debería pasar, revisamos que la lógica es idéntica |

---

## ✅ CHECKLIST PARA EJECUTAR

### Operación 1: Mirror Fix
- [ ] Abrir `FixtureMapper.ts` línea 156
- [ ] Eliminar 3 líneas del mirror (comentario + if statement)
- [ ] Guardar archivo
- [ ] `npm run build` exitoso
- [ ] `npm run dev` arranca sin errores
- [ ] Visual test: MOVING_LEFT y MOVING_RIGHT son diferentes
- [ ] Logs confirman mirrorSign=-1 para RIGHT
- [ ] Techno mirror se ve como "puertas abriéndose"

### Operación 2: VibeMovementManager
- [ ] Crear `VibeMovementManager.ts`
- [ ] Copiar código de pattern generators
- [ ] Refactorizar `TitanEngine.calculateMovement()`
- [ ] Agregar import de VibeMovementManager
- [ ] `npm run build` exitoso
- [ ] `npm run dev` arranca sin errores
- [ ] Visual test: Latino figure8 sigue funcionando
- [ ] Visual test: Todos los patrones se ven igual que antes

### Operación 3: Test Suite
- [ ] Crear archivos .test.ts
- [ ] `npm test` exitoso
- [ ] Todos los tests pasan
- [ ] Coverage > 80%

---

**Estado:** LISTO PARA EJECUCIÓN

Radwulf, este playbook te lleva paso a paso. La operación 1 es criticial y rápida. Las otras 2 son importantes para mantener sanidad del código pero no son urgentes.

¿Vamos con el fix del mirror primero?
