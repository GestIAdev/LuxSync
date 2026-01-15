# WAVE 287: FIESTA LATINA - STATUS REPORT 🌴

**Fecha**: 2 Enero 2026  
**Arquitecto**: El Arquitecto  
**Desarrolladores**: PunkOpus + Radwulf  
**Estado**: 🔍 INVESTIGACIÓN PRE-IMPLEMENTACIÓN

---

## 📋 ÍNDICE EJECUTIVO

Tras completar la **perfección cromática de Techno-Club** (WAVE 287), hemos iniciado la investigación profunda de **Fiesta Latina**. Este reporte documenta el estado actual del vibe, identifica problemas arquitectónicos y propone soluciones elegantes.

**Conclusión anticipada**: Fiesta Latina tiene **buena estructura pero necesita refinamientos críticos** en:
1. **Integridad de paleta**: LatinoStereoPhysics sobrescribe la paleta en lugar de modularla
2. **Protección de colores**: Sin neonProtocol, amarillos/naranjas pueden escapar
3. **Armonía visual**: La física inyecta colores NEON fijos sin respetar el KEY detectado

---

## 🎨 SECCIÓN 1: COLOR & CONSTITUCIÓN

### 1.1 LATINO_CONSTITUTION (colorConstitutions.ts)

```typescript
export const LATINO_CONSTITUTION: GenerationOptions = {
  atmosphericTemp: 4800,           // ← NEUTRA (no hay gravedad térmica)
  forbiddenHueRanges: [[210, 240]], // ← Solo prohíbe azules tristes
  allowedHueRanges: [              // ← 3 rangos separados
    [0, 60],    // ZONA SOLAR: Rojos + Naranjas + Amarillos
    [120, 200], // ZONA SELVA: Verdes + Cian + Turquesa
    [260, 360]  // ZONA NEÓN: Magentas + Rosas + Rojos
  ],
  saturationRange: [75, 100],      // ← Vibrante (vs Techno 90-100)
  lightnessRange: [45, 65],        // ← Rango amplio (vs Techno 45-55)
  elasticRotation: 20,             // ← 20° para escapar (vs Techno 15°)
  mudGuard: {
    enabled: true,
    swampZone: [50, 90],           // ← Amarillos y mostazas
    minLightness: 50,              // ← Luminosidad mínima
    minSaturation: 80,             // ← Saturación mínima
  },
  tropicalMirror: true,            // ← Ambient = Secondary + 180°
  accentBehavior: 'quaternary',    // ← Color derivado cuaternario
  dimmingConfig: {
    floor: 0.05,  // ← Blackout casi total permitido
    ceiling: 1.0,
  },
};
```

### 1.2 PROBLEMAS IDENTIFICADOS

| Problema | Severidad | Descripción | Impacto |
|----------|-----------|-------------|--------|
| **Sin neonProtocol** | 🔴 CRÍTICA | Latino no tiene protección contra amarillos/naranjas feos | Colores sucios pueden escapar si las estrategias generan paletas malas |
| **mudGuard sin implementar** | 🟠 ALTA | Code exists but NEVER executed in SeleneColorEngine | Swamp zone check nunca se aplica |
| **Gravedad térmica = 0** | 🟡 MEDIA | 4800K es neutral, no hay atracción hacia polo cálido/frío | Las estrategias generan colores puros pero potencialmente planos |
| **allowedHueRanges parciales** | 🟡 MEDIA | 3 rangos separados - ¿bug [0,360] afecta rangos parciales? | Necesita test para confirmar normalizeHue() funciona en múltiples rangos |
| **tropicalMirror + allowedHueRanges conflict** | 🟡 MEDIA | Si allowedHueRanges excluye una zona, el mirror puede generar hues prohibidos | Secondary se genera libre, luego mirror lo rota +180°, ¿queda en zona permitida? |

---

## 🌴 SECCIÓN 2: FÍSICA & REACTIVIDAD (LatinoStereoPhysics.ts)

### 2.1 ARQUITECTURA ACTUAL

El LatinoStereoPhysics es un **sistema de modulación de paleta en tiempo real** que detecta subgéneros musicales e inyecta efectos:

```typescript
public apply(
  palette: LatinoPalette,      // ← Paleta de Selene (ignorada en Cumbia)
  metrics: LatinoAudioMetrics,
  bpm?: number,
  mods?: ElementalModifiers
): LatinoPhysicsResult
```

### 2.2 SUBGÉNEROS Y SUS COMPORTAMIENTOS

#### A. CUMBIA (90-130 BPM)

**Filosofía**: "Neón multicolor, movimiento constante, sin solar flare"

```
Trigger: bassPulse > 0.4
Efecto:  
  - ACCENT rota: Magenta → Cyan → Lime (Back PARs)
  - PRIMARY rota: Cyan → Orange → Magenta → Lime (Front PARs, cada 4 beats)
  - forceMovement = true (movers siempre activos)
  
Colores fijos:
  - NEON_MAGENTA: {h: 300, s: 100, l: 65}
  - NEON_CYAN: {h: 180, s: 100, l: 60}
  - NEON_LIME: {h: 120, s: 100, l: 55}
  - NEON_ORANGE: {h: 30, s: 100, l: 55} ← NUEVA WAVE 156
```

**PROBLEMA CRÍTICO**: ⚠️ En Cumbia, la paleta de SeleneColorEngine **se ignora completamente**. Los colores son inyectados manualmente, sin respetar:
- La Key detectada (musical harmony)
- La estrategia (complementary, triadic, etc.)
- El accentBehavior quaternary de la constitución

**Ejemplo**: 
- Si estamos en D major (verde ~130°), y Cumbia rota a NEON_MAGENTA (300°), perdemos la identidad armónica.

#### B. REGGAETON (≤90 BPM)

**Filosofía**: "Solar Flare dorado en kicks, Machine Gun en cortes"

```
SOLAR FLARE Trigger:
  - bassPulse > 0.80 (kick threshold)
  - bassDelta > 0.15 (cambio brusco, no solo nivel sostenido)
  
Efecto:
  - accent = HSL(38, 100, 45) ← ORO PROFUNDO (WAVE 163 improvement)
  - primary brillo += (flareIntensity * 20)
  
MACHINE GUN Trigger:
  - energyDelta >= 0.4 (caída de 40%)
  - deltaTime <= 100ms (rápido)
  - previousEnergy > 0.6 (veníamos de energía alta)
  
Efecto:
  - dimmerOverride = 0 (blackout total)
  - Duración = 3 frames (~50ms @ 60fps)
```

**CARACTERÍSTICAS POSITIVAS**:
- ✅ El umbral dual (nivel + delta) evita falsos positivos
- ✅ El oro puro (L=45) es visualmente fuerte, no blanco lavado
- ✅ Machine Gun es dramático pero breve

**POTENCIAL PROBLEMA**:
- ⚠️ Solar Flare usa `accent` directamente. Si `accentBehavior: quaternary`, ¿se sobrescribe el color calculado?
- ⚠️ No respeta la Key musical - el oro es oro siempre, no armoniza

#### C. SALSA (>130 BPM)

**Filosofía**: "Movimiento perpetuo"

```
Efecto único:
  - forceMovement = true
  
(Sin efectos especiales de color)
```

#### D. GENERIC (Fallback)

**Filosofía**: "Cuando en duda, neón"

```
Trigger: bassPulse > 0.5
Efecto:  Rotar Magenta → Cyan → Lime
```

### 2.3 ELEMENTAL MODULATION (WAVE 273)

El sistema acepta `ElementalModifiers` (Fuego/Tierra/Aire/Agua) que modulan:

```typescript
const thresholdMod = mods?.thresholdMultiplier ?? 1.0;
const brightnessMod = mods?.brightnessMultiplier ?? 1.0;

// Solar Flare threshold modulado:
const effectiveKickThreshold = 0.80 * thresholdMod;

// Solar Flare brightness modulado:
const modulatedFlareColor = {
  l: Math.min(100, 45 * brightnessMod)
};
```

**Potencial**: Sistema elegante para variar reactividad por elemento. ✅

---

## ⚠️ SECCIÓN 3: PROBLEMAS ARQUITECTÓNICOS CRÍTICOS

### Problema A: LatinoStereoPhysics Sobrescribe la Paleta

**Situación**:
1. SeleneColorEngine genera una paleta basada en la Key musical (armónica)
2. LatinoStereoPhysics **reemplaza completamente** los colores en Cumbia

**Ejemplo concreto**:
```
Frame actual: Key = D (verde 130°)
Estrategia: TRIADIC → Secondary = 250° (magenta)
Paleta Selene: Primary=130° (verde), Secondary=250°, Ambient=50°

LatinoStereoPhysics entra:
- subGenre = "cumbia"
- beatCounter++ → accentColors[index] = NEON_MAGENTA = {h: 300, s: 100, l: 65}
- primaryColors[index] = NEON_CYAN = {h: 180, s: 100, l: 60}

Resultado FINAL:
- Primary: 180° (cyan) ← SOBRESCRITO, perdió la identidad de D major
- Accent: 300° (magenta) ← SOBRESCRITO, no es armónico
- Secondary: 250° (magenta original) ← INTACTO
```

**Impacto**: La armonía musical se pierde. El espectador ve "colores bonitos" pero no "colores que cuentan la historia de la música".

### Problema B: Sin Protección de Color

**Situación**:
- Techno tiene `neonProtocol` para evitar amarillos/naranjas feos
- Latino NO tiene protección similar
- El `mudGuard` existe pero no está implementado en SeleneColorEngine

**Riesgo**: Si la estrategia genera una paleta con amarillos/mostazas sucios (L=40%, S=60%), el LatinoStereoPhysics no los sanitiza.

### Problema C: Conflicto allowedHueRanges + tropicalMirror

**Situación**:
```typescript
allowedHueRanges: [[0, 60], [120, 200], [260, 360]]
tropicalMirror: true  // Ambient = Secondary + 180°
```

**Ejemplo conflictivo**:
- Secondary calculado = 50° (DENTRO de [0, 60])
- Mirror rota: 50° + 180° = 230°
- ¿230° está permitido? NO - cae en zona prohibida [210, 240]

**Resultado**: ¿La paleta final viola allowedHueRanges?

---

## 🔧 SECCIÓN 4: PROPUESTAS DE SOLUCIÓN

### Solución A: NATIVE LATINO PROTOCOL (RECOMENDADO)

**Filosofía**: "Respetar Selene, modular sin sobrescribir"

```typescript
// 1. Añadir neonProtocol a LATINO_CONSTITUTION
neonProtocol: {
  enabled: true,
  dangerZone: [40, 90],       // Mostazas/amarillos sucios SOLO
  minSaturation: 85,          // Menos agresivo que Techno (que es 90)
  minLightness: 55,           // Menos que Techno (que es 75)
  fallbackToWhite: false,     // En Latino, NUNCA blanco - ir a cyan frío
},

// 2. Modificar LatinoStereoPhysics para MODULAR sin sobrescribir
// En Cumbia, en lugar de:
//   resultPalette.accent = NEON_MAGENTA
// 
// Hacer:
//   const accentColor = resultPalette.accent  // Mantener original
//   accentColor.s = Math.min(100, accentColor.s + 15)  // Boost sat
//   accentColor.l = Math.min(65, accentColor.l + 10)   // Boost light
//   // Resultado: Color original, pero más vibrante
```

**Ventajas**:
- ✅ Respeta la armonía de Selene
- ✅ Respeta la Key detectada
- ✅ Modula en lugar de sobrescribir
- ✅ Arquitectura limpia

**Desventajas**:
- Requiere refactorizar LatinoStereoPhysics (trabajo modesto)

### Solución B: IMPLEMENT mudGuard EN SELENE

**Paso 1**: Implementar la lógica que ya existe en interfaz

```typescript
// SeleneColorEngine.ts - después de applyNeonProtocol
if (options?.mudGuard?.enabled) {
  const [swampMin, swampMax] = options.mudGuard.swampZone;
  // Aplicar lógica similar a neonProtocol
  // Si hue está en swamp, forzar minLightness y minSaturation
}
```

**Ventaja**: Reutilizar código ya escrito.

### Solución C: RESOLVER tropicalMirror + allowedHueRanges

**Test necesario**:
```typescript
// ¿Qué pasa cuando el mirror genera hues fuera de allowedHueRanges?
// Opción 1: El mirror se aplica ANTES de la validación → hue inválido
// Opción 2: El mirror se aplica DESPUÉS → hue se snappea/rota
// Opción 3: El mirror respeta allowedHueRanges → complejo

// Recomendación: Documentar claramente el orden de operaciones
```

---

## 📊 SECCIÓN 5: COMPARATIVA TECHNO vs LATINO

### Arquitectura de Color

| Aspecto | Techno | Latino | Estado |
|---------|--------|--------|--------|
| **atmosphericTemp** | 9500K (frío) | 4800K (neutro) | OK - diferentes filosofías |
| **neonProtocol** | ✅ Sí | ❌ No | ISSUE A |
| **mudGuard** | No aplica | ✅ Definido pero ❌ NO implementado | ISSUE B |
| **forbiddenHueRanges** | [[25, 80]] | [[210, 240]] | OK - diferentes zonas |
| **allowedHueRanges** | [[0, 360]] | 3 rangos separados | OK - múltiples rangos soportados |

### Arquitectura de Física

| Aspecto | Techno | Latino | Estado |
|---------|--------|--------|--------|
| **Subgéneros** | N/A | CUMBIA/REGGAETON/SALSA | OK - detección automática |
| **Modulación paleta** | N/A | Sobrescribe (Cumbia) | ISSUE A - pierde armonía |
| **Solar Flare** | N/A | ✅ Doble trigger (nivel+delta) | Excelente |
| **Machine Gun** | N/A | ✅ Blackout dramático | Excelente |
| **ElementalModifiers** | No | ✅ Modulación zodiacal | OK - extensible |

---

## 🎯 SECCIÓN 6: RECOMENDACIONES PARA PRÓXIMAS FASES

### INMEDIATO (Esta sesión o próxima)

1. **Implementar mudGuard en SeleneColorEngine** (30 min)
   - Copiar lógica de neonProtocol
   - Aplicar a Primary, Secondary, Ambient, Accent
   - Test visual

2. **Refactorizar LatinoStereoPhysics - CUMBIA MODE** (1-2 horas)
   - En lugar de sobrescribir, MODULAR:
     - Boost saturación del accent (+15)
     - Boost luminosidad del primary (+10)
     - Mantener hues originales
   - Result: Neon injection sin perder identidad de Key

3. **Test tropicalMirror logic** (30 min)
   - Verificar que Secondary + 180° siempre cae en allowedHueRanges
   - Si no, documentar el comportamiento

### CORTO PLAZO (Próximos commits)

4. **Añadir neonProtocol a LATINO_CONSTITUTION**
   - dangerZone: [40, 90] (mostazas, no amarillos puros)
   - minSaturation: 85, minLightness: 55
   - fallbackToWhite: false (ir a cyan)

5. **Elemental Modulation refinement**
   - Test cómo los modificadores zodiacales afectan reactividad
   - Documentar efectos por elemento

6. **Performance audit**
   - LatinoStereoPhysics tiene muchas detecciones de subgénero por frame
   - ¿Impacta CPU?

---

## 📈 SECCIÓN 7: MÉTRICAS DE ÉXITO

Una vez implementadas las soluciones, las métricas de éxito son:

- [ ] **Cumbia**: Colores vibrantes que rotan, respetan la Key musical
- [ ] **Reggaeton**: Solar Flare dorado puro en kicks, Machine Gun dramático en cortes
- [ ] **Salsa**: Movimiento perpetuo, colores armónicos
- [ ] **Sin Sobrescrituras**: La paleta de Selene se MODULA, nunca se reemplaza
- [ ] **Sin Colores Sucios**: Amarillos/mostazas feos se transforman en neon o cyan
- [ ] **Consistencia Visual**: Los mismos BPM generan el mismo subgénero y reactividad

---

## 🏛️ SECCIÓN 8: CONCLUSIONES

**Estado General**: ✅ SÓLIDO pero con **3 issues críticos**

**Solidez**:
- ✅ Detección de subgéneros funcional
- ✅ Solar Flare y Machine Gun bien implementados
- ✅ Elemental Modulation extensible
- ✅ Constitución clara y documentada

**Issues Críticos**:
- 🔴 LatinoStereoPhysics sobrescribe paleta en Cumbia (pierde armonía)
- 🔴 Sin neonProtocol (colores sucios pueden escapar)
- 🔴 mudGuard definido pero no implementado

**Recomendación**: Antes de "perfeccionar" Fiesta Latina, **resolver estos 3 issues** mediante las soluciones propuestas. El trabajo es modesto pero crítico para la integridad arquitectónica.

---

## 📎 APÉNDICES

### A. Stack Trace de Sobrescritura (Cumbia)

```
Frame 120 (Cumbia detected):
  1. SeleneColorEngine.generate() → Paleta base (Key=D, triadic)
     Result: {primary: 130°, secondary: 250°, ambient: 50°}
  
  2. TitanEngine.calculatePalette() → Aplica física
     Calls: LatinoStereoPhysics.apply(palette)
  
  3. LatinoStereoPhysics.apply():
     - Detecta subGenre = "cumbia"
     - beatCounter = 120
     - accentColors[120 % 3] = NEON_MAGENTA {300°, 100%, 65%}
     - resultPalette.accent = {300°, 100%, 65%} ← SOBRESCRITO
  
  4. TitanEngine → HAL → Fixtures
     Resultado FINAL: Accent es magenta puro, no armónico
```

### B. AllowedHueRanges Test Case

```typescript
// LATINO_CONSTITUTION
allowedHueRanges: [[0, 60], [120, 200], [260, 360]]

// Caso de test: tropicalMirror
Secondary = 50° (dentro de [0, 60] ✅)
Ambient = Secondary + 180° = 230° (¿dentro de algún rango?)

Verificar en [0, 60]: 230 < 0? NO
Verificar en [120, 200]: 230 < 120? NO, 230 > 200? SÍ → NO
Verificar en [260, 360]: 230 < 260? SÍ → NO

RESULTADO: 230° cae FUERA de allowedHueRanges
¿Qué pasa entonces? ¿Se snappea? ¿Se ignora?
```

### C. Archivos Clave a Revisar

- ✅ `src/engine/color/SeleneColorEngine.ts` - Línea 1097 onwards (applyNeonProtocol)
- ⚠️ `src/hal/physics/LatinoStereoPhysics.ts` - Línea 190 onwards (Cumbia mode)
- 📋 `src/engine/color/colorConstitutions.ts` - Línea 138 onwards (LATINO_CONSTITUTION)
- 🔧 `src/hal/physics/PhysicsEngine.ts` - Mover logic y decay

---

**Documento preparado para**: El Arquitecto  
**Fecha de revisión sugerida**: 3-4 Enero 2026  
**Prioridad**: 🔴 ALTA - Resolver antes de release de Fiesta Latina

---

*"La arquitectura es el arte de tomar decisiones sin sobrescribir las decisiones anteriores."*  
— PunkOpus, 2 Enero 2026
