# 🏛️ WAVE 1000: HAL GENESIS - Hardware Translation & Safety Layer

**Fecha:** 24 Enero 2026  
**Estado:** ✅ COMPLETO - INTEGRADO EN WAVE 1001  
**Commits:** `50dbbc7` (Arquitectura) → WAVE 1001 (Integración)

---

## 📋 RESUMEN EJECUTIVO

WAVE 1000 implementa una **Capa de Abstracción de Hardware** que permite a Selene (la IA) soñar en colores RGB mientras los fixtures mecánicos como el Beam 2R reciben instrucciones en su "dialecto nativo" sin quemarse.

### El Problema

```
Selene: "Quiero #00FFFF (Cian Cyberpunk)!"
Beam 2R: "¿Qué? Solo tengo 8 colores en mi rueda y tardo 500ms en cambiar"
```

### La Solución

```
ColorTranslator: "El Aquamarine (DMX 75) es 85% similar al Cian"
SafetyLayer: "Y solo puedes cambiar cada 500ms, relájate"
```

---

## 🏗️ ARQUITECTURA

```
┌─────────────────────────────────────────────────────────────────┐
│                        SELENE (AI)                              │
│                    Sueña en RGB (#00FFFF)                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  📚 FIXTURE PROFILES                            │
│    "¿Qué capacidades tiene este fixture?"                       │
│                                                                 │
│    Beam 2R: { mixing: 'wheel', minChangeTimeMs: 500 }           │
│    LED PAR: { mixing: 'rgb', shutter: 'digital' }               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  🎨 COLOR TRANSLATOR                            │
│    "RGB → Color de rueda más cercano"                           │
│                                                                 │
│    #00FFFF → Buscar en rueda → Aquamarine (DMX 75)              │
│    Distancia: 15 (< 180 = good match)                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  🛡️ SAFETY LAYER                                │
│    "¿Es seguro hacer este cambio?"                              │
│                                                                 │
│    CHECK 1: ¿Pasaron 500ms? → Sí → PERMITIR                     │
│    CHECK 2: ¿Caos detectado? → No → PERMITIR                    │
│    CHECK 3: ¿En latch? → No → PERMITIR                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DMX OUTPUT                                 │
│                   Canal 6 → 75 (Aquamarine)                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 ARCHIVOS CREADOS

### `src/hal/translation/FixtureProfiles.ts`

**EL DICCIONARIO** - Define qué puede hacer cada fixture.

```typescript
interface FixtureProfile {
  id: string
  name: string
  type: 'beam' | 'spot' | 'wash' | 'par' | 'strobe' | 'generic'
  
  colorEngine: {
    mixing: 'rgb' | 'rgbw' | 'cmy' | 'wheel' | 'hybrid'
    colorWheel?: {
      colors: WheelColor[]
      minChangeTimeMs: number  // ¡CRÍTICO!
    }
  }
  
  shutter: {
    type: 'digital' | 'mechanical'
    maxStrobeHz?: number
  }
  
  safety: {
    isDischarge: boolean
    cooldownTime: number
  }
}
```

**Perfiles incluidos:**
- `BEAM_2R_PROFILE`: Beam 2R / LB230N / Sharpy Clone
- `LED_PAR_RGB_PROFILE`: PAR LED genérico
- `LED_WASH_PROFILE`: Moving Head Wash LED
- `LED_STROBE_PROFILE`: Strobe LED

### `src/hal/translation/ColorTranslator.ts`

**EL INTÉRPRETE** - Convierte RGB a color de rueda.

```typescript
class ColorTranslator {
  // Método principal
  translate(targetRGB: RGB, profile: FixtureProfile): ColorTranslationResult
  
  // Utilidades
  getAvailableColors(profile): WheelColor[]
  debugDistances(target, profile): void  // Para debugging
}
```

**Algoritmo:**
1. Si fixture RGB → Pass-through
2. Si fixture Wheel → Calcular distancia ponderada a cada color
3. Seleccionar vecino más cercano
4. Si distancia > 180 → Marcar como "poor match" (considerar blanco)

### `src/hal/translation/HardwareSafetyLayer.ts`

**EL BÚNKER** - Protege la maquinaria.

```typescript
class HardwareSafetyLayer {
  filter(
    fixtureId: string,
    requestedColorDmx: number,
    profile: FixtureProfile,
    currentDimmer: number
  ): SafetyFilterResult
}
```

**Protecciones:**

| Protección | Trigger | Acción |
|------------|---------|--------|
| **DEBOUNCE** | Cambio más rápido que `minChangeTimeMs` | Bloquear, mantener color anterior |
| **LATCH** | >3 cambios/segundo | Bloquear color por 2 segundos |
| **STROBE DELEGATION** | >10 cambios bloqueados | Sugerir usar strobe en vez de color |

---

## 🔌 USO

### Opción 1: One-liner (Recomendado)

```typescript
import { translateColor } from '../hal/translation'

const result = translateColor(
  'fixture-123',           // ID
  { r: 0, g: 255, b: 255 }, // Color deseado (Cian)
  'Beam LB230N',           // Nombre del fixture
  undefined,               // profileId (opcional)
  255                      // Dimmer actual
)

// result:
// {
//   rgb: { r: 0, g: 255, b: 255 },  // Color traducido
//   colorWheelDmx: 75,               // Valor para CH6
//   colorName: 'Aquamarine',
//   wasTranslated: true,
//   wasBlocked: false,
//   delegateToStrobe: false
// }
```

### Opción 2: Componentes separados

```typescript
import { 
  getProfileByModel, 
  getColorTranslator, 
  getHardwareSafetyLayer 
} from '../hal/translation'

// 1. Obtener perfil
const profile = getProfileByModel('LB230N')

// 2. Traducir color
const translator = getColorTranslator()
const translation = translator.translate({ r: 0, g: 255, b: 255 }, profile)

// 3. Filtrar por seguridad
const safety = getHardwareSafetyLayer()
const result = safety.filter('fixture-123', translation.colorWheelDmx!, profile, 255)
```

---

## 🎯 PRÓXIMOS PASOS (NO IMPLEMENTADO AÚN)

### 1. Integrar en FixtureMapper

En `src/hal/mapping/FixtureMapper.ts`, antes de generar el DMX packet:

```typescript
// WAVE 1000: Apply color translation
const profile = getProfileByModel(fixture.name)
const translation = translateColor(
  fixture.id,
  { r: state.r, g: state.g, b: state.b },
  fixture.name,
  fixture.profileId
)

// Usar translation.rgb en lugar de state.r/g/b
// Usar translation.colorWheelDmx para canal color_wheel
```

### 2. Añadir profileId a fixtures

En el patch de fixtures, permitir especificar qué perfil usar:

```typescript
{
  name: 'Beam 2R Front Left',
  dmxAddress: 1,
  profileId: 'beam-2r',  // ← NUEVO
  // ...
}
```

### 3. Editor de perfiles (UI)

Permitir al usuario:
- Crear perfiles personalizados
- Definir colores de rueda para SU fixture específico
- Ajustar tiempos de seguridad

---

## 📊 MÉTRICAS DE SEGURIDAD

```typescript
const safety = getHardwareSafetyLayer()
const metrics = safety.getMetrics()

// {
//   totalBlockedChanges: 42,
//   totalLatchActivations: 3,
//   totalStrobeDelegations: 1,
//   activeFixtures: 4,
//   fixturesInLatch: 0
// }

safety.printMetrics() // Log detallado
```

---

## 🧪 TESTING

### Test manual rápido:

```typescript
import { 
  getColorTranslator, 
  BEAM_2R_PROFILE 
} from '../hal/translation'

const translator = getColorTranslator()

// Ver todas las distancias
translator.debugDistances(
  { r: 0, g: 255, b: 255 },  // Cian
  BEAM_2R_PROFILE
)

// Output:
// [ColorTranslator] 🔬 Distances from RGB(0, 255, 255):
//   Open (White)    DMX:  0 | Distance: 255.0 | █████████████████████████
//   Red             DMX: 15 | Distance: 360.6 | ████████████████████████████████████
//   Cyan            DMX: 75 | Distance:   0.0 | 
//   Aquamarine      DMX: 30 | Distance:  15.2 | █
//   ...
```

---

## 💡 FILOSOFÍA

> *"Es mejor un show imperfecto que un fixture roto"*

> *"Selene sueña en RGB, los Beams hablan su dialecto"*

> *"Si no puedes cambiar de color lo bastante rápido, parpadea en blanco"*

---

## 📝 NOTAS TÉCNICAS

### ¿Por qué distancia ponderada?

El ojo humano es más sensible al verde que al rojo, y más al rojo que al azul. La fórmula:

```
distance = sqrt(0.299*ΔR² + 0.587*ΔG² + 0.114*ΔB²)
```

...compensa esta diferencia para que los colores "parezcan" más cerca de lo que Selene pidió.

### ¿Por qué cache cuantizado?

Colores muy similares (ej: RGB 0,255,255 y RGB 0,248,250) probablemente mapean al mismo color de rueda. Cuantizamos a pasos de 8 para aumentar cache hits sin perder precisión útil.

### ¿Por qué latch de 2 segundos?

El efecto estroboscópico típico dura 1-4 beats. Con un latch de 2 segundos, dejamos que el efecto termine sin destruir la rueda de colores.

---

**WAVE 1000: HAL GENESIS** - La IA ya puede soñar en colores, y los fixtures mecánicos sobreviven para contarlo. 🎨🛡️
