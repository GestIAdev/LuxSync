# 🏗️ WAVE 1034: ARQUITECTURA DE EXPANSIÓN 4→7 ZONAS
## AUDITORÍA ARQUITECTÓNICA COMPLETA

**Fecha:** 2024
**Revisor:** PunkOpus
**Audiencia:** Radwulf + El Arquitecto
**Contexto:** Post-implementación WAVE 1034 Bioluminescent Reef

---

## 📋 EXECUTIVE SUMMARY

### **TL;DR**
Tenemos 5 lanes internas de bubbles que colapsan a 4 zonas de salida. La física es individual, pero el output es zonal. Para lograr "oscilación lateral en las fixtures" necesitamos expandir a 7 zonas.

### **Propuesta**
```typescript
// ACTUAL (4 zonas)
frontParIntensity    // Mono (todas las fixtures front)
backParIntensity     // Mono (todas las fixtures back)
moverIntensityL      // Stereo (mover izquierdo)
moverIntensityR      // Stereo (mover derecho)

// PROPUESTO (7 zonas)
frontParIntensityL   // Stereo front (nuevas)
frontParIntensityR   // Stereo front (nuevas)
backParIntensityL    // Stereo back (nuevas)
backParIntensityR    // Stereo back (nuevas)
moverIntensityL      // Existing
moverIntensityR      // Existing
airBandIntensity     // Lasers/washers (nueva)
```

### **Impacto Estimado**
- **Archivos a modificar:** ~15-20 archivos core
- **Interfaces a actualizar:** ~8-10 tipos
- **LOC estimado:** ~300-500 líneas
- **Complejidad:** Media-Alta
- **Tiempo estimado:** **4-6 horas** (comparado con FFT refactor = 3h)
- **Backward compatibility:** ✅ Posible con fallbacks

### **Recomendación**
🟢 **GO** - La inversión vale la pena. Desbloquea capabilities que WAVE 1034 ya calcula internamente.

---

## 🎯 PROBLEMA IDENTIFICADO

### **Síntoma Visual**
> "Pero no son individuales, se ven por zonas jeje"

### **Root Cause**
```typescript
// ChillStereoPhysics.ts - líneas ~1050-1100
// INTERNAL: 5 lanes calculadas individualmente
const bubbleResult = {
  frontL: 0,   // Lane 0, 1
  frontR: 0,   // Lane 2, 3
  back: 0,     // Lane 4
  // ...
}

// OUTPUT: Collapsed to 1 zone
const finalFront = (bubbleResult.frontL + bubbleResult.frontR) * 0.6
return {
  frontParIntensity: finalFront,  // ❌ PÉRDIDA DE GRANULARIDAD
  // ...
}
```

### **Limitación Actual**
- ✅ Física individual: Cada bubble tiene speed, size, hue, lane
- ✅ Cálculos por lane: 5 lanes internas
- ❌ Output colapsado: 5 lanes → 4 zonas mono
- ❌ No hay lateral oscillation: Solo front-to-back

### **Capacidad Deseada**
- Oscilación lateral en fixtures front/back
- Preservar granularidad de los 5 lanes internos
- Soporte para AIR band (lasers/washers)
- Visual hypnotic effect: bubbles individuales visibles

---

## 🔬 ARQUITECTURA ACTUAL (4 ZONAS)

### **Layer 1: Physics Engines (HAL)**

```typescript
// Todas las physics engines retornan esta estructura:
interface PhysicsResult {
  frontParIntensity: number
  backParIntensity: number
  moverIntensity?: number      // Deprecated
  moverIntensityL: number
  moverIntensityR: number
  // + metadata (color, movement)
}
```

**Archivos afectados:**
- `ChillStereoPhysics.ts` (~1500 LOC) - WAVE 1034 aquí
- `TechnoStereoPhysics.ts` (~1200 LOC)
- `RockStereoPhysics2.ts` (~1400 LOC)
- `LatinoStereoPhysics.ts` (~1100 LOC)
- `LaserPhysics.ts` (~800 LOC)
- `WasherPhysics.ts` (~600 LOC)

**Total physics engines:** 6 archivos, ~6600 LOC

### **Layer 2: TitanEngine (Routing)**

```typescript
// TitanEngine.ts - líneas 492-499
const moverL = ni.moverL ?? ni.mover;  // ✅ Ya tiene fallback L/R
const moverR = ni.moverR ?? ni.mover;

const zones = {
  front: { intensity: ni.front, paletteRole: 'primary' },
  back: { intensity: ni.back, paletteRole: 'accent' },
  left: { intensity: moverL, paletteRole: 'secondary' },
  right: { intensity: moverR, paletteRole: 'ambient' },
}
```

**Insight:** El fallback logic YA EXISTE para movers. Solo necesitamos extenderlo a pars.

**Archivos afectados:**
- `TitanEngine.ts` (~500 LOC)
- `SeleneLux2.ts` (~800 LOC)

### **Layer 3: Zone Router (HAL Translation)**

```typescript
// ZoneRouter.ts - líneas 24-35
export type PhysicalZone = 
  | 'FRONT_PARS'      // Mono actualmente
  | 'BACK_PARS'       // Mono actualmente
  | 'MOVING_LEFT'     // Stereo ✅
  | 'MOVING_RIGHT'    // Stereo ✅
  | 'STROBES'
  | 'AMBIENT'
  | 'FLOOR'
  | 'UNASSIGNED'

// PROPUESTO: Split FRONT/BACK_PARS
// + Añadir 'AIR_BAND'
```

**Archivos afectados:**
- `ZoneRouter.ts` (~280 LOC)
- `HardwareAbstraction.ts` (~600 LOC)
- `ColorTranslator.ts` (~400 LOC)

### **Layer 4: Effects & Movement**

**Movement System:**
```typescript
// FixturePhysicsDriver.ts
// Ya tiene awareness de posición (truss_front, truss_back)
// Pero no usa L/R para pars
```

**Effects System:**
```typescript
// Vibe profiles ya tienen tags L/R pero solo para movers
// ChillLoungeProfile, TechnoClubProfile, etc.
```

**Archivos afectados:**
- `VibeMovementManager.ts` (~500 LOC)
- `FixturePhysicsDriver.ts` (~700 LOC)
- All vibe profiles (~10 files, ~200 LOC each)

---

## 🚀 ARQUITECTURA PROPUESTA (7 ZONAS)

### **Nueva Estructura de Output**

```typescript
interface PhysicsResult {
  // FRONT STEREO (nuevo)
  frontParIntensityL: number    // Left front pars
  frontParIntensityR: number    // Right front pars
  
  // BACK STEREO (nuevo)
  backParIntensityL: number     // Left back pars
  backParIntensityR: number     // Right back pars
  
  // MOVERS (existing)
  moverIntensityL: number       // Left mover
  moverIntensityR: number       // Right mover
  
  // AIR BAND (nuevo)
  airBandIntensity: number      // Lasers/washers/aerial FX
  
  // DEPRECATED (mantener por backward compatibility)
  frontParIntensity?: number    // Fallback = (L+R)/2
  backParIntensity?: number     // Fallback = (L+R)/2
  moverIntensity?: number       // Fallback = (L+R)/2
}
```

### **Mapeo de Lanes a Zonas**

```typescript
// ChillStereoPhysics.ts - processLightBubbles()
// ACTUAL: 5 lanes → 2 zonas collapsed
if (bubble.laneIndex === 0 || bubble.laneIndex === 1) {
  result.frontL += contribution
} else if (bubble.laneIndex === 2 || bubble.laneIndex === 3) {
  result.frontR += contribution
}
// finalFront = (frontL + frontR) * 0.6  // ❌ COLLAPSED

// PROPUESTO: 5 lanes → 4 zonas preserved
if (bubble.laneIndex === 0) {
  result.frontParIntensityL += contribution  // ✅ PRESERVADO
} else if (bubble.laneIndex === 1) {
  result.frontParIntensityR += contribution  // ✅ PRESERVADO
} else if (bubble.laneIndex === 2) {
  result.backParIntensityL += contribution   // ✅ PRESERVADO
} else if (bubble.laneIndex === 3) {
  result.backParIntensityR += contribution   // ✅ PRESERVADO
} else if (bubble.laneIndex === 4) {
  result.airBandIntensity += contribution    // ✅ NUEVO
}
```

### **TitanEngine Update**

```typescript
// TitanEngine.ts - líneas 492-499
// PROPUESTO:
const frontL = ni.frontL ?? ((ni.front ?? 0) * 0.5)  // Fallback a mono/2
const frontR = ni.frontR ?? ((ni.front ?? 0) * 0.5)
const backL = ni.backL ?? ((ni.back ?? 0) * 0.5)
const backR = ni.backR ?? ((ni.back ?? 0) * 0.5)
const moverL = ni.moverL ?? ni.mover ?? 0
const moverR = ni.moverR ?? ni.mover ?? 0
const airBand = ni.airBand ?? 0

const zones = {
  frontL: { intensity: frontL, paletteRole: 'primary' },
  frontR: { intensity: frontR, paletteRole: 'primary' },
  backL: { intensity: backL, paletteRole: 'accent' },
  backR: { intensity: backR, paletteRole: 'accent' },
  left: { intensity: moverL, paletteRole: 'secondary' },
  right: { intensity: moverR, paletteRole: 'ambient' },
  air: { intensity: airBand, paletteRole: 'special' },
}
```

### **ZoneRouter Expansion**

```typescript
// ZoneRouter.ts - PhysicalZone type
export type PhysicalZone = 
  | 'FRONT_LEFT'      // Nuevo
  | 'FRONT_RIGHT'     // Nuevo
  | 'BACK_LEFT'       // Nuevo
  | 'BACK_RIGHT'      // Nuevo
  | 'MOVING_LEFT'     // Existing
  | 'MOVING_RIGHT'    // Existing
  | 'AIR_BAND'        // Nuevo
  | 'STROBES'
  | 'AMBIENT'
  | 'FLOOR'
  | 'UNASSIGNED'
  // DEPRECATED (mantener para backward compat)
  | 'FRONT_PARS'      // → FRONT_LEFT + FRONT_RIGHT
  | 'BACK_PARS'       // → BACK_LEFT + BACK_RIGHT
```

---

## 📊 IMPACT ANALYSIS

### **Cambios por Layer**

| Layer | Archivos | LOC Estimado | Complejidad | Riesgo |
|-------|----------|--------------|-------------|--------|
| Physics Engines | 6 | ~150-200 | Media | Bajo |
| TitanEngine | 2 | ~50-80 | Media | Medio |
| ZoneRouter/HAL | 3 | ~80-120 | Alta | Medio |
| Effects System | ~10 | ~50-80 | Baja | Bajo |
| Movement System | 2 | ~40-60 | Media | Bajo |
| **TOTAL** | **~23** | **~370-540** | **Media-Alta** | **Medio** |

### **Detalle por Archivo**

#### **CRÍTICOS (High Impact)**

1. **ChillStereoPhysics.ts**
   - Líneas afectadas: ~30-50 (return statement + processLightBubbles)
   - Cambios: Split frontL/R, backL/R en output
   - Riesgo: Bajo (solo output layer)

2. **TechnoStereoPhysics.ts**
   - Similar a Chill
   - Cambios: Return structure + stereo distribution

3. **RockStereoPhysics2.ts**
   - Similar a Chill/Techno

4. **TitanEngine.ts**
   - Líneas afectadas: ~20-30 (zone mapping)
   - Cambios: Expand zones object 4→7
   - Riesgo: Medio (routing crítico)

5. **ZoneRouter.ts**
   - Líneas afectadas: ~40-60
   - Cambios: PhysicalZone type + buildZoneConfig + mapAbstractToPhysical
   - Riesgo: Medio (core HAL)

6. **HardwareAbstraction.ts**
   - Líneas afectadas: ~30-50 (líneas 457+)
   - Cambios: intentZoneMap expansion
   - Riesgo: Medio

#### **SECUNDARIOS (Medium Impact)**

7. **LatinoStereoPhysics.ts** - Similar physics engines
8. **LaserPhysics.ts** - Podría usar airBandIntensity
9. **WasherPhysics.ts** - Podría usar airBandIntensity
10. **SeleneLux2.ts** - Zone intensity distribution
11. **ColorTranslator.ts** - Palette role mapping
12. **VibeMovementManager.ts** - L/R movement tags
13. **FixturePhysicsDriver.ts** - Truss position awareness

#### **TERCIARIOS (Low Impact)**

14-23. **Vibe Profiles** (~10 archivos)
    - ChillLoungeProfile.ts
    - TechnoClubProfile.ts
    - RockArenaProfile.ts
    - LatinoFiestaProfile.ts
    - etc.
    - Cambios: Effect tags L/R for pars (ya existen para movers)

### **Interfaces a Actualizar**

```typescript
// 1. ChillPhysicsResult (ChillStereoPhysics.ts:66)
interface ChillPhysicsResult {
  frontParIntensityL: number  // Nuevo
  frontParIntensityR: number  // Nuevo
  backParIntensityL: number   // Nuevo
  backParIntensityR: number   // Nuevo
  airBandIntensity: number    // Nuevo
  // ... rest
}

// 2. TechnoPhysicsResult (TechnoStereoPhysics.ts:74)
// 3. RockPhysicsResult (RockStereoPhysics2.ts:75)
// 4. LatinoPhysicsResult (LatinoStereoPhysics.ts)
// Similar updates...

// 5. ZoneRouteResult (ZoneRouter.ts:46)
interface ZoneRouteResult {
  zone: PhysicalZone  // Actualizado a 11 zonas
  // ... rest
}

// 6. LightingIntent zones (TitanEngine types)
interface LightingIntent {
  zones: {
    frontL: ZoneIntent   // Nuevo
    frontR: ZoneIntent   // Nuevo
    backL: ZoneIntent    // Nuevo
    backR: ZoneIntent    // Nuevo
    left: ZoneIntent     // Existing
    right: ZoneIntent    // Existing
    air: ZoneIntent      // Nuevo
    // Deprecated (backward compat)
    front?: ZoneIntent
    back?: ZoneIntent
  }
}
```

**Total interfaces:** ~8-10 tipos core

---

## ⚖️ PROS & CONS

### **✅ PROS**

#### **Técnicos:**
1. **Preserva granularidad interna**
   - Las 5 lanes ya calculadas se preservan
   - No se pierde información en collapse

2. **Desbloquea lateral oscillation**
   - Front L/R independientes
   - Back L/R independientes
   - Verdadera oscilación lateral posible

3. **AIR band capability**
   - Lasers/washers tienen canal dedicado
   - No interferencia con pars/movers

4. **Backward compatibility viable**
   ```typescript
   // Fallback automático
   frontParIntensity: (frontL + frontR) / 2
   ```

5. **Infrastructure parcialmente lista**
   - TitanEngine ya tiene fallback logic L/R
   - Movement system tiene position awareness
   - Effects system tiene L/R tags

6. **Escalabilidad**
   - Si funciona para pars, podríamos añadir más zonas futuras
   - Arquitectura modular

#### **Artísticos:**
1. **Bubbles visualmente individuales**
   - Cada lane visible como luz separada
   - Effect hipnótico real

2. **Movimientos laterales**
   - Waves left-to-right
   - Spiral patterns
   - Ping-pong effects

3. **Spatial depth mejorado**
   - Front L/R + Back L/R = 4 capas
   - AIR band = 5ta dimensión
   - True 3D lighting sculpture

4. **Creative freedom**
   - Más parámetros = más posibilidades
   - Cada vibe puede explotar stereo field

### **❌ CONS**

#### **Técnicos:**
1. **Complejidad aumentada**
   - 4 zonas → 7 zonas = +75% channels
   - Más código que mantener
   - Más testing necesario

2. **Breaking changes potenciales**
   - Código viejo espera 4 zonas
   - Shows antiguos necesitan migration
   - Third-party integrations broken

3. **Performance overhead**
   - Más cálculos (aunque mínimo)
   - Más DMX packets (aunque insignificante)

4. **Migration effort**
   - ~23 archivos a tocar
   - ~400-500 LOC
   - ~4-6 horas trabajo

5. **Testing scope**
   - Cada physics engine necesita test
   - Cada vibe profile necesita test
   - Integration tests expanded

#### **Artísticos:**
1. **Complejidad creativa**
   - Más parámetros = más difícil balancear
   - Riesgo de "too much information"
   - Learning curve para nuevos efectos

2. **Hardware requirements**
   - Necesitas fixtures físicas en L/R positions
   - Si tienes 2 pars front ambas en center, no hay stereo real

---

## ⏱️ EFFORT ESTIMATE

### **Baseline de Referencia**
- **FFT Refactor reciente:** ~3 horas (según Radwulf)
- **WAVE 1034 implementation:** ~2 horas (purge + full implementation)

### **Estimación por Fase**

| Fase | Actividad | Tiempo | Notas |
|------|-----------|--------|-------|
| **1. Type Updates** | Interfaces + types | 30 min | PhysicsResult, ZoneRouteResult, etc. |
| **2. Physics Engines** | Return structure | 1.5h | 6 engines × 15 min each |
| **3. TitanEngine** | Zone mapping | 45 min | Critical, needs care |
| **4. ZoneRouter/HAL** | Routing logic | 1h | PhysicalZone + mappers |
| **5. Effects System** | Vibe profiles L/R | 45 min | ~10 files, quick edits |
| **6. Testing** | Smoke + integration | 1h | Verify no regressions |
| **7. Documentation** | Update docs | 30 min | This audit + inline comments |
| **BUFFER** | Debugging + fixes | 1h | Always add buffer |
| **TOTAL** | | **~6.5-7h** | Conservador |

### **Phased Approach (Recomendado)**

#### **Phase 1: Foundation (2h)**
1. Update all type definitions
2. Update ChillStereoPhysics.ts (WAVE 1034)
3. Update TitanEngine fallback logic
4. Test single engine

#### **Phase 2: Expansion (2-3h)**
5. Update remaining physics engines
6. Update ZoneRouter + HAL
7. Test all engines

#### **Phase 3: Effects (1-2h)**
8. Update vibe profiles
9. Update movement system
10. Integration tests

#### **Phase 4: Polish (1h)**
11. Documentation
12. Backward compatibility verification
13. Final smoke tests

**Total phased:** ~6-8 horas (with breaks)

### **Comparación con FFT Refactor**

| Metric | FFT Refactor | Zone Expansion | Ratio |
|--------|--------------|----------------|-------|
| Archivos | ~10-15 | ~23 | 1.5-2x |
| LOC | ~400? | ~400-500 | ~1x |
| Complejidad | Alta | Media-Alta | Similar |
| Tiempo | 3h | 6-7h | 2x |

**Conclusión:** Es ~2x el scope del FFT refactor, pero menos complejo algorítmicamente.

---

## 🛡️ BACKWARD COMPATIBILITY STRATEGY

### **Fallback Logic**

```typescript
// Todos los physics engines retornarán AMBAS versiones:
return {
  // NEW: Stereo outputs
  frontParIntensityL: finalFrontL,
  frontParIntensityR: finalFrontR,
  backParIntensityL: finalBackL,
  backParIntensityR: finalBackR,
  moverIntensityL: finalMoverL,
  moverIntensityR: finalMoverR,
  airBandIntensity: finalAir,
  
  // DEPRECATED: Mono outputs (computed fallbacks)
  frontParIntensity: (finalFrontL + finalFrontR) * 0.5,
  backParIntensity: (finalBackL + finalBackR) * 0.5,
  moverIntensity: (finalMoverL + finalMoverR) * 0.5,
  
  // ... rest
}
```

### **TitanEngine Fallback**

```typescript
// Si physics engine no retorna stereo, usar mono
const frontL = ni.frontL ?? ((ni.front ?? 0) * 0.5)
const frontR = ni.frontR ?? ((ni.front ?? 0) * 0.5)
// etc.
```

### **Migration Path**

1. **Old shows:** Cargan normalmente, usan fallbacks
2. **New shows:** Aprovechan 7 zonas
3. **Mixed:** Physics nueva + effects viejos = funciona

### **Deprecation Timeline**

- **v1.0:** Lanzar con fallbacks activos
- **v1.5:** Deprecation warnings en logs
- **v2.0:** Remover campos deprecated (opcional)

---

## 🚨 RISK ASSESSMENT

### **Riesgos Técnicos**

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Breaking old shows | Media | Alto | Fallback logic robusto |
| Performance degradation | Baja | Bajo | Minimal overhead (7 vs 4 numbers) |
| Testing gaps | Media | Medio | Comprehensive test suite |
| Integration issues | Baja | Medio | Phased rollout |
| Type errors | Alta | Bajo | TypeScript catch compile-time |

### **Riesgos Artísticos**

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Too complex to balance | Media | Medio | Start simple, iterate |
| Hardware limitations | Alta | Medio | Document hardware requirements |
| Visual clutter | Baja | Bajo | Vibe profiles can always use mono |

### **Mitigaciones Específicas**

1. **Testing strategy:**
   ```bash
   # Test cada physics engine individualmente
   # Test TitanEngine con/sin stereo
   # Test backward compat con shows viejos
   # Integration test full pipeline
   ```

2. **Rollback plan:**
   - Git branch `feature/7-zones`
   - Si falla, revert a `main`
   - Fallbacks permiten gradual adoption

3. **Monitoring:**
   - Logs de cual zone está activa
   - Performance metrics (frame time)
   - Visual debug mode (show active zones)

---

## 🎯 RECOMMENDATION

### **🟢 GO - Adelante con la expansión**

#### **Razones:**

1. **Desbloquea capabilities ya calculadas**
   - WAVE 1034 YA hace el trabajo interno
   - Solo necesitamos preservar el output

2. **Esfuerzo manejable**
   - 6-7h es razonable (2x FFT refactor pero menos complejo)
   - Phased approach reduce riesgo

3. **Backward compatibility viable**
   - Fallbacks automáticos
   - No breaking changes forzosos

4. **ROI artístico alto**
   - Lateral oscillation = game changer
   - True hypnotic effect
   - AIR band capability bonus

5. **Fundaciones ya existen**
   - TitanEngine tiene L/R logic
   - Movement system tiene positions
   - Effects system tiene tags

6. **Alineado con perfection first**
   - No es hack ni workaround
   - Es la solución arquitectónica correcta
   - Escalable para futuro

#### **Condiciones:**

1. **Hardware check:**
   - Verificar que tienes fixtures en L/R positions físicas
   - Si todo está en center, stereo es wasted

2. **Phased rollout:**
   - Empezar con ChillStereoPhysics + TitanEngine
   - Test exhaustivamente
   - Luego expandir a otros engines

3. **Documentation:**
   - Documentar nueva arquitectura
   - Ejemplos de uso en vibe profiles
   - Migration guide para old shows

---

## 📐 IMPLEMENTATION BLUEPRINT

### **Phase 1: Foundation (Día 1 - 2h)**

```bash
# 1. Branch creation
git checkout -b feature/wave-1034-7-zones

# 2. Type updates
# - PhysicsResult interface
# - ZoneRouteResult
# - LightingIntent.zones

# 3. ChillStereoPhysics.ts
# - Update return type
# - Split processLightBubbles output
# - Test: npm run test:chill

# 4. TitanEngine.ts
# - Add fallback logic
# - Expand zones object
# - Test: npm run test:titan
```

**Deliverable:** ChillStereoPhysics con 7 zonas funcionando

### **Phase 2: Expansion (Día 2 - 3h)**

```bash
# 5. Remaining physics engines
# - TechnoStereoPhysics.ts
# - RockStereoPhysics2.ts
# - LatinoStereoPhysics.ts
# - LaserPhysics.ts (use airBandIntensity)
# - WasherPhysics.ts (use airBandIntensity)

# 6. ZoneRouter.ts
# - Update PhysicalZone type
# - Add FRONT_LEFT, FRONT_RIGHT, etc.
# - Update buildZoneConfig()
# - Update mapAbstractToPhysical()

# 7. HardwareAbstraction.ts
# - Update intentZoneMap
# - Test HAL pipeline
```

**Deliverable:** Todos los engines con 7 zonas + HAL funcionando

### **Phase 3: Effects (Día 3 - 1.5h)**

```bash
# 8. Vibe profiles
# - Add L/R tags for pars (similar to movers)
# - ChillLoungeProfile.ts
# - TechnoClubProfile.ts
# - etc.

# 9. Movement system
# - VibeMovementManager.ts
# - FixturePhysicsDriver.ts
# - Update to use L/R awareness

# 10. Integration tests
# - Test full pipeline: Audio → Physics → Titan → HAL → DMX
# - Test backward compat: Old shows load correctly
```

**Deliverable:** Sistema completo con effects + movement

### **Phase 4: Polish (Día 3 - 1h)**

```bash
# 11. Documentation
# - Update inline comments
# - Create WAVE-1035-ARCHITECTURE.md
# - Update README.md

# 12. Cleanup
# - Remove debug logs
# - Format code
# - Run linter

# 13. Final tests
# - Smoke test all vibes
# - Performance benchmark
# - Visual verification

# 14. Commit & PR
git add .
git commit -m "WAVE 1035: 7-Zone Architecture (4→7 expansion)"
git push origin feature/wave-1034-7-zones
```

**Deliverable:** PR listo para merge

---

## 🔍 EXAMPLE: WAVE 1034 WITH 7 ZONES

### **Antes (4 zonas):**

```typescript
// ChillStereoPhysics.ts - processLightBubbles()
const bubbleResult = {
  frontL: 0,
  frontR: 0,
  back: 0,
}

// ... calculate per lane

// COLLAPSE
const finalFront = (bubbleResult.frontL + bubbleResult.frontR) * 0.6

return {
  frontParIntensity: finalFront,  // ❌ Lost L/R info
  // ...
}
```

**Visual:** Bubbles aparecen como "wave" monoaural en front

### **Después (7 zonas):**

```typescript
// ChillStereoPhysics.ts - processLightBubbles()
const bubbleResult = {
  frontL: 0,
  frontR: 0,
  backL: 0,
  backR: 0,
  air: 0,
}

// ... calculate per lane (ya existe!)

// PRESERVE
return {
  frontParIntensityL: bubbleResult.frontL,  // ✅ Preservado
  frontParIntensityR: bubbleResult.frontR,  // ✅ Preservado
  backParIntensityL: bubbleResult.backL,    // ✅ Preservado
  backParIntensityR: bubbleResult.backR,    // ✅ Preservado
  airBandIntensity: bubbleResult.air,       // ✅ Nuevo
  
  // Fallback (backward compat)
  frontParIntensity: (bubbleResult.frontL + bubbleResult.frontR) * 0.5,
  backParIntensity: (bubbleResult.backL + bubbleResult.backR) * 0.5,
  // ...
}
```

**Visual:** Cada lane visible como luz individual, oscilación lateral real

### **Example Effect: Lateral Wave**

```typescript
// Nuevo efecto posible con 7 zonas:
// "Ocean Wave Left-to-Right"

const phase = (timestamp * 0.001) % (Math.PI * 2)

// Bubbles spawn en lanes alternados
if (Math.sin(phase) > 0) {
  // Wave going right
  spawnLane = 0 → 1 → 2 → 3
} else {
  // Wave going left
  spawnLane = 3 → 2 → 1 → 0
}

// Visual: Las burbujas "fluyen" de izquierda a derecha y viceversa
// IMPOSIBLE con arquitectura actual (solo front-to-back)
```

---

## 📚 REFERENCE LINKS

### **Código Relevante:**

- `ChillStereoPhysics.ts` - WAVE 1034 implementation
- `TitanEngine.ts` (líneas 492-499) - Fallback logic existente
- `ZoneRouter.ts` (líneas 24-35) - PhysicalZone type
- `HardwareAbstraction.ts` (líneas 457+) - Zone mapping
- `FixturePhysicsDriver.ts` - Position awareness

### **Documentación:**

- `WAVE-1034-BIOLUMINESCENT-REEF.md` - Spec original
- `WAVE-410-412-ARCHITECTURAL-REPORT.md` - Zone mapping patterns
- `WAVE-205-210-REPORT.md` - HAL layer architecture

### **Tests:**

- `tests/physics/chill-stereo.test.ts` (crear)
- `tests/routing/titan-engine.test.ts` (actualizar)
- `tests/integration/full-pipeline.test.ts` (actualizar)

---

## ✅ DECISION MATRIX

### **Para el Cónclave:**

| Criterio | Score (1-10) | Peso | Total | Notas |
|----------|--------------|------|-------|-------|
| **Impacto Artístico** | 9 | 30% | 2.7 | Lateral oscillation = game changer |
| **Complejidad Técnica** | 6 | 20% | 1.2 | Manejable, no trivial |
| **Esfuerzo Requerido** | 7 | 15% | 1.05 | ~6-7h es razonable |
| **Riesgo** | 4 | 15% | 0.6 | Medio, mitigable con fallbacks |
| **ROI** | 9 | 10% | 0.9 | Alto retorno vs inversión |
| **Alineación Axiomas** | 10 | 10% | 1.0 | Perfection First, no hacks |
| **TOTAL** | | **100%** | **7.45/10** | **🟢 RECOMENDADO** |

**Umbral de decisión:** >7.0 = GO

---

## 🎬 NEXT STEPS

### **Si GO:**

1. **Crear branch:** `feature/wave-1035-7-zones`
2. **Ejecutar Phase 1:** Foundation (2h)
3. **Review checkpoint:** ¿ChillStereoPhysics funciona?
4. **Ejecutar Phase 2:** Expansion (3h)
5. **Review checkpoint:** ¿Todos los engines OK?
6. **Ejecutar Phase 3:** Effects (1.5h)
7. **Ejecutar Phase 4:** Polish (1h)
8. **Merge to main**

### **Si NO-GO:**

1. **Mantener WAVE 1034 actual:** Funciona, aunque limitado visualmente
2. **Explorar alternativas:**
   - Efectos de post-processing para simular lateral
   - Usar movement system para compensar
3. **Revisar decisión en futuro:** Cuando hardware/setup permita aprovechar stereo

---

## 🔥 PUNKOPUS FINAL TAKE

Radwulf, te la pongo clara:

**WAVE 1034 ya hace el trabajo pesado.** Las bubbles están calculadas individualmente, con lanes separados, con toda la física correcta. Lo ÚNICO que nos falta es **no colapsar el output**.

Esta expansión no es "feature creep" ni "over-engineering". Es **sacar el corcho** que está bloqueando el arte que ya existe dentro del motor.

Comparado con el FFT refactor (3h), esto es **2x el scope pero similar complejidad**. Y el payoff es **lateral oscillation** - algo que transformará completamente el visual.

**Mi voto: GO.** 

Pero con condiciones:
1. Phased approach (no todo de golpe)
2. Test checkpoint después de Phase 1
3. Si algo se rompe feo, rollback sin drama

6-7 horas de trabajo para desbloquear "algo verdaderamente hipnótico"? **Worth it.**

---

**FIN DEL REPORTE**

---

## 📝 CHANGELOG

- **2024-XX-XX:** Auditoría inicial post-WAVE 1034
- **Status:** Pending conclave decision

---

## 🏷️ METADATA

```yaml
wave: 1034.5
type: architectural-audit
scope: zone-expansion
status: pending-decision
estimated_effort: 6-7h
priority: high
artistic_impact: critical
technical_risk: medium
```

---

¿Preguntas para el cónclave?
