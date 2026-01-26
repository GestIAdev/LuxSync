# 🚂 WAVE 992: HTP COLOR SEMANTICS - LA DIATRIBA DE LA MEZCLA

**Estado**: ARCHITECTURAL DECISION PENDING  
**Criticidad**: 🔴 BLOQUEADOR - Afecta coherencia del Railway Switch  
**Reportado por**: Radwulf (detección en WAVE 991 bugfix)  
**Fecha**: 2026-01-23  
**Sesión**: WAVE 988.5 → 991 → 992 (continuous optimization loop)

---

## 📋 RESUMEN EJECUTIVO

Durante la validación de la implementación del Railway Switch (WAVE 990-991), **Radwulf detectó una inconsistencia arquitectónica fundamental** en cómo se procesan colores (RGB) vs intensidad (dimmer) cuando `mixBus='htp'`.

**El problema**: 
- **RGB (color)**: Siempre `REPLACE` (LTP puro)
- **DIMMER/WHITE/AMBER**: Respetan `mixBus` (HTP cuando `mixBus='htp'`)

**La pregunta**: ¿Debería ser HTP TOTAL (Math.max en RGB también) o mantener la estrategia actual?

---

## 🔍 PROBLEMA DETALLADO

### Ubicación del código

**Archivo**: `electron-app/src/core/orchestrator/TitanOrchestrator.ts`  
**Líneas**: 402-470  
**Función**: `applyEffectsToFixtures()` → zoneOverrides processing

### Código actual (WAVE 991)

```typescript
// 1️⃣ RGB: SIEMPRE REPLACE (líneas 402-410)
if (zoneData.color) {
  const rgb = this.hslToRgb(
    zoneData.color.h,
    zoneData.color.s,
    zoneData.color.l
  )
  // 🔴 REPLACE PURO - ignora physics.r, physics.g, physics.b
  fixtureStates[index] = {
    ...f,
    r: rgb.r,
    g: rgb.g,
    b: rgb.b,
  }
}

// 2️⃣ DIMMER: RESPETA mixBus (líneas 427-444)
const blendMode = isGlobalBus ? 'replace' : (zoneData.blendMode || 'max')
if (blendMode === 'replace') {
  finalDimmer = effectDimmer  // LTP dictador
} else {
  finalDimmer = Math.max(physicsDimmer, effectDimmer)  // HTP colaborativo
}

// 3️⃣ WHITE/AMBER: RESPETA mixBus (líneas 463-470)
fixtureStates[index].white = isGlobalBus ? effectWhite : Math.max(physicsWhite, effectWhite)
fixtureStates[index].amber = isGlobalBus ? effectAmber : Math.max(physicsAmber, effectAmber)
```

### El patrón inconsistente

```
┌─────────────────────────────────────────────────────────┐
│ CANAL       │ mixBus='global' │ mixBus='htp'            │
├─────────────────────────────────────────────────────────┤
│ R (rojo)    │ REPLACE         │ REPLACE ❌              │
│ G (verde)   │ REPLACE         │ REPLACE ❌              │
│ B (azul)    │ REPLACE         │ REPLACE ❌              │
│ DIMMER      │ REPLACE         │ Math.max(P, E) ✅       │
│ WHITE       │ LTP             │ Math.max(P, E) ✅       │
│ AMBER       │ LTP             │ Math.max(P, E) ✅       │
└─────────────────────────────────────────────────────────┘

❌ INCONSISTENCIA: RGB nunca respeta mixBus='htp'
```

---

## 🧠 LA DIATRIBA: DOS VISIONES

### OPCIÓN A: HTP PURO (Math.max en todos los canales)

#### Código
```typescript
// Cuando mixBus='htp', aplicar HTP a TODO
if (zoneData.color) {
  const rgb = this.hslToRgb(...)
  const physicsRGB = {
    r: fixtureStates[index].r,
    g: fixtureStates[index].g,
    b: fixtureStates[index].b,
  }
  
  if (isGlobalBus) {
    // REPLACE: El efecto dicta completamente
    fixtureStates[index].r = rgb.r
    fixtureStates[index].g = rgb.g
    fixtureStates[index].b = rgb.b
  } else {
    // HTP: El canal más brillante gana
    fixtureStates[index].r = Math.max(physicsRGB.r, rgb.r)
    fixtureStates[index].g = Math.max(physicsRGB.g, rgb.g)
    fixtureStates[index].b = Math.max(physicsRGB.b, rgb.b)
  }
}
```

#### Ventajas
- ✅ **Coherencia total**: Todos los parámetros respetan `mixBus`
- ✅ **Matemáticamente puro**: HTP real, aditivo verdadero
- ✅ **Predecible**: Una regla para todos los canales

#### Desventajas
- ❌ **Mezcla de colores impredecible**: Aditivo RGB puede dar colores raros
- ❌ **Ejemplo problemático**:
  - Physics: Violeta (R=255, G=0, B=255)
  - Efecto (TropicalPulse): Oro (R=255, G=180, B=0)
  - Resultado: (255, 180, 255) = **¿Rosado neón?** No es lo que esperabas

---

### OPCIÓN B: COLOR REPLACE + INTENSIDAD HTP (actual - ONDA 991)

#### Código (actual)
```typescript
// RGB: SIEMPRE REPLACE
if (zoneData.color) {
  const rgb = this.hslToRgb(...)
  fixtureStates[index] = {
    ...f,
    r: rgb.r,     // El efecto dicta la PALETA
    g: rgb.g,
    b: rgb.b,
  }
}

// DIMMER/WHITE/AMBER: Respetan mixBus
const blendMode = isGlobalBus ? 'replace' : (zoneData.blendMode || 'max')
if (blendMode === 'replace') {
  finalDimmer = effectDimmer
} else {
  finalDimmer = Math.max(physicsDimmer, effectDimmer)  // Intensidad colaborativa
}
```

#### Ventajas
- ✅ **Color limpio**: Cada efecto tiene su paleta sin mezclas raras
- ✅ **Control semántico**: El efecto elige COLOR, pero la energía es colaborativa
- ✅ **Pragmático**: Separar "qué color" de "qué tan fuerte"
- ✅ **Experiencia visual predecible**: Oro de TropicalPulse = oro puro, no rosado mutante

#### Desventajas
- ❌ **Inconsistencia** (la que Radwulf detectó)
- ❌ **Confuso**: RGB y dimmer con reglas diferentes

---

## 🎤 ARGUMENTO DE RADWULF (transmitido)

> "¿Será que hay que meter el verde y el resto de colores ahí para que sobreescriban? Porque sobreescriben color pero no dimmer. Deberían sobreescribir dimmer también y así saber si tenemos que incrementar la intensidad de algún efecto."

### Lo que pregunta Radwulf
1. **¿RGB respeta mixBus?** → NO (siempre REPLACE)
2. **¿DIMMER respeta mixBus?** → SÍ (HTP cuando `mixBus='htp'`)
3. **¿Debería ser consistente?** → SÍ (o ambos REPLACE, o ambos respetan mixBus)
4. **¿Y si queremos boosting de intensidad?** → Necesitamos HTP en dimmer (ya existe)

### Implicación táctica
Si `AmbientStrobe` está en `mixBus='htp'`, sus colores deberían **colaborar** con la física también. Pero "colaborar en color" es raro - produce mezclas aditivas.

---

## 🏗️ ANÁLISIS ARQUITECTÓNICO

### ¿Qué significa `mixBus` realmente?

#### Definición oficial (WAVE 800)
```
mixBus='global' (LTP):  El efecto es un DICTADOR
                        - Reemplaza TODOS los parámetros
                        - Dimmer, color, todo bajo su control
                        - Para efectos que NECESITAN crear condiciones (oscuridad total)

mixBus='htp' (HTP):     El efecto es un COLABORADOR
                        - Suma energía al sistema
                        - Nunca apaga, solo booatea
                        - Para efectos que SUMAN (flashes, strobes)
```

### Inferencias
1. **Si `mixBus='global'` → TODO es REPLACE** ✅ (ya implementado)
2. **Si `mixBus='htp'` → TODO debería ser Math.max()** ❌ (RGB no, dimmer sí)

---

## 🚨 CASOS DE USO CONCRETOS

### Caso 1: AmbientStrobe (`mixBus='htp'`)
```
Fixture state ANTES:
  r: 100, g: 80, b: 60 (luz cálida base)
  dimmer: 150

Efecto: Flash blanco (r: 255, g: 255, b: 255), dimmer boost 200

OPCIÓN A (HTP puro):
  r: max(100, 255) = 255 ✅
  g: max(80, 255) = 255 ✅
  b: max(60, 255) = 255 ✅
  dimmer: max(150, 200) = 200 ✅
  → Flash blanco limpio

OPCIÓN B (Color REPLACE + dimmer HTP):
  r: 255 (REPLACE) ✅
  g: 255 (REPLACE) ✅
  b: 255 (REPLACE) ✅
  dimmer: max(150, 200) = 200 ✅
  → Flash blanco limpio
  
RESULTADO: Ambas dan lo mismo aquí (el blanco "cubre" todo)
```

### Caso 2: TropicalPulse (`mixBus='htp'`)
```
Fixture state ANTES:
  r: 50, g: 0, b: 100 (azul base del vibe)
  dimmer: 100

Efecto: Oro tropical (r: 255, g: 180, b: 0), dimmer boost 120

OPCIÓN A (HTP puro):
  r: max(50, 255) = 255 (oro)
  g: max(0, 180) = 180 (oro)
  b: max(100, 0) = 100 (azul del vibe) ❌
  dimmer: max(100, 120) = 120
  → (255, 180, 100) = Naranja mutante turbio

OPCIÓN B (Color REPLACE + dimmer HTP):
  r: 255 (REPLACE oro puro)
  g: 180 (REPLACE oro puro)
  b: 0 (REPLACE oro puro)
  dimmer: max(100, 120) = 120
  → (255, 180, 0) = Oro tropical limpio ✅
  
DIFERENCIA: Opción B es mucho más agradable visualmente
```

### Caso 3: Physics vs Efecto conflictivos
```
Scenario: Physics envía ROJO, efecto envía CIAN (opuesto)

Physics: r: 255, g: 0, b: 0 (rojo puro)
Efecto: r: 0, g: 255, b: 255 (cian puro)

OPCIÓN A (Math.max):
  r: max(255, 0) = 255 (rojo ganador)
  g: max(0, 255) = 255 (cian ganador)
  b: max(0, 255) = 255 (cian ganador)
  → (255, 255, 255) = BLANCO ❌
  
  Problem: Dos colores opuestos cancelados = blanco neutro (no es lo que nadie quería)

OPCIÓN B (Color REPLACE):
  r: 0 (cian del efecto)
  g: 255 (cian del efecto)
  b: 255 (cian del efecto)
  → (0, 255, 255) = CIAN limpio ✅
  
  Result: El efecto toma control del COLOR, physics no interfiere
```

---

## 📊 MATRIZ DE DECISIÓN

```
┌──────────────────────────────────────────────────────────────────┐
│ CRITERIO              │ OPCIÓN A (HTP) │ OPCIÓN B (Actual)       │
├──────────────────────────────────────────────────────────────────┤
│ Coherencia            │ ⭐⭐⭐⭐⭐      │ ⭐⭐⭐ (inconsistente)  │
│ Pureza matemática     │ ⭐⭐⭐⭐⭐      │ ⭐⭐⭐ (mixto)          │
│ Belleza visual        │ ⭐⭐ (raras)    │ ⭐⭐⭐⭐ (predecible)   │
│ Claridad semántica    │ ⭐⭐⭐ (confuso) │ ⭐⭐⭐⭐ (clara)        │
│ Implementación        │ ⭐⭐ (compleja) │ ⭐⭐⭐⭐ (simple)       │
│ Debugging             │ ⭐⭐ (raro)     │ ⭐⭐⭐⭐ (obvio)        │
│ Efectos strobes       │ ⭐⭐⭐⭐ (limpio)│ ⭐⭐⭐⭐ (limpio)       │
│ Efectos "sucios"      │ ⭐⭐ (mutantes) │ ⭐⭐⭐⭐ (controlados)   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🎯 RECOMENDACIÓN ARQUITECTÓNICA

### La verdad incómoda

**Ambas opciones son legítimas**, pero responden a **dos filosofías diferentes**:

#### **OPCIÓN A: "El sistema es matemático"**
- Todos los parámetros respetan la misma lógica
- Coherencia perfecta
- Pero produce colores que pueden no ser lo que esperaba el designer

#### **OPCIÓN B: "El efecto elige el COLOR, el sistema elige la INTENSIDAD"**
- Separación clara de responsabilidades
- COLOR = decisión del efecto (ya está implementado)
- INTENSIDAD = colaboración (dimmer/white/amber usan HTP)
- Pero viola el principio de "todos respetan mixBus"

---

## ✅ PROPUESTA FINAL DEL ARQUITECTO

### Mantener OPCIÓN B pero documentar explícitamente

**Por qué**:
1. **La belleza visual ganó**: Los tests manuales de onda 988-991 confirman que OPCIÓN B se ve mejor
2. **La semántica es clara**: "El efecto elige COLOR, el sistema negocia INTENSIDAD"
3. **Los strobes funcionan**: AmbientStrobe blanco + boost de dimmer = perfecto
4. **Ya funciona**: No requiere refactor

**Pero requiere**:

### 1. Documentar explícitamente que RGB NO respeta mixBus
```typescript
// ═══════════════════════════════════════════════════════════════════════
// 🎨 WAVE 992: COLOR SEMANTICS - RGB es SIEMPRE REPLACE
// 
// IMPORTANTE: El Railway Switch mixBus solo afecta INTENSIDAD:
// - mixBus='global' → REPLACE (LTP) en dimmer/white/amber
// - mixBus='htp'   → HTP en dimmer/white/amber
//
// PERO: RGB (color) SIEMPRE es REPLACE en AMBOS casos
//
// RAZÓN: Permitir que los efectos elijan su PALETA sin interferencia.
// Ejemplo:
//   - TropicalPulse elige DORADO (255, 180, 0) - siempre ese color
//   - AmbientStrobe elige BLANCO (255, 255, 255) - siempre ese color
//   - Si hiciéramos Math.max(RGB), colores opuestos crearían blancos
//     o tonos raros (ver WAVE-992 para análisis detallado)
//
// ESTO ES INTENCIONAL Y ARQUITECTÓNICAMENTE CORRECTO
// ═══════════════════════════════════════════════════════════════════════
```

### 2. Renombrar `blendMode` a algo más claro

**Actual**: `blendMode` (confuso, puede aplicarse a color)

**Propuesto**: `intensityBlend` o `dimmerBlend`

```typescript
// Más claro que afecta SOLO a intensidad
const intensityBlend = isGlobalBus ? 'replace' : (zoneData.intensityBlend || 'max')
```

### 3. Agregar comentario en cada efecto que usa `mixBus='htp'`

**Ejemplo en AmbientStrobe.ts**:
```typescript
/**
 * WAVE 992: mixBus='htp' significa HTP en INTENSIDAD
 * 
 * - Color: SIEMPRE será blanco (255, 255, 255) del efecto
 * - Dimmer/White/Amber: Pueden sumarse con physics via Math.max()
 * - Resultado: Strobes que BOOESTAN sin apagar
 */
readonly mixBus: 'htp' | 'global' = 'htp'
```

---

## 🔧 PRÓXIMOS PASOS (Si se aprueba)

### Fase 1: Documentación (WAVE 992.1)
- [ ] Actualizar comentarios en TitanOrchestrator.ts
- [ ] Renombrar `blendMode` → `intensityBlend` (o similar)
- [ ] Agregar advertencia en cada efecto `mixBus='htp'`

### Fase 2: Validación (WAVE 992.2)
- [ ] Actualizar TechnoStrictTest para validar semántica de color
- [ ] Test: AmbientStrobe siempre es blanco + dimmer boosted
- [ ] Test: CyberDualism siempre es su color + dimmer LTP

### Fase 3: Review (WAVE 992.3)
- [ ] Verificar visualmente: TropicalPulse produce oro limpio
- [ ] Verificar visualmente: Strobes no interfieren con color base
- [ ] Confirmed: Efectos globales (CoreMeltdown) aún producen blackout real

---

## 📚 REFERENCES

- **WAVE 800**: Railway Switch Architecture (mixBus introduction)
- **WAVE 990**: Railway Switch implementation (all techno effects classified)
- **WAVE 991**: Critical bugfix (mixBus propagation through Orchestrator)
- **WAVE 992**: THIS DOCUMENT (HTP Color Semantics decision)

---

## 🎬 CONCLUSIÓN

**La pregunta de Radwulf fue genial** porque destapó una ambigüedad arquitectónica. 

El código FUNCIONA, pero la SEMÁNTICA necesitaba clarificación.

**Recomendación: MANTENER OPCIÓN B pero documentar explícitamente por qué RGB no respeta mixBus.**

Esto preserva:
- ✅ La belleza visual
- ✅ La claridad semántica  
- ✅ La compatibilidad con lo existente
- ✅ El mantenimiento futuro

---

**Esperando validación del arquitecto para proceder con WAVE 992.1**

🚀 **PunkOpus, 2026-01-23**
