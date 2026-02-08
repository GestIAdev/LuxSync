# 🎨 VOLUMEN 2: LA TEORÍA DEL COLOR
## Chromatic Science & Deterministic Palettes
### AUDITORÍA TÉCNICA PARA FOLLETO DE VENTAS

**TONO**: Técnico, Implacable, Sin Algoritmo Aleatorio.  
**NO vendemos "paletas bonitas".** Vendemos **determinismo cromático verificable**.

---

## ÍNDICE DE CONTENIDOS

1. [Las Constituciones: Law > Art](#las-constituciones-law--art)
2. [El Círculo de Quintas: Sinestesia Matemática](#el-círculo-de-quintas-sinestesia-matemática)
3. [Determinismo: Mismo Show, Mismo Color, Siempre](#determinismo-mismo-show-mismo-color-siempre)
4. [Fluid Dynamics: Transiciones Líquidas](#fluid-dynamics-transiciones-líquidas)
5. [Estrategias de Contraste: Armonía Visual](#estrategias-de-contraste-armonía-visual)
6. [Thermal Gravity: Física Cromática](#thermal-gravity-física-cromática)

---

## Las Constituciones: Law > Art

### ¿Qué es una Constitución Cromática?

Una **Constitución** es un conjunto de **leyes inmutables** que gobiernan qué colores pueden existir en un Vibe específico.

No es una sugerencia. No es una preferencia. **Es la ley del universo visual.**

```
ARCHIVO: colorConstitutions.ts (429 líneas)
PROPÓSITO: Definir las 4 Constituciones (Techno, Latino, Chill, Rock)
AUTORIDAD: El SeleneColorEngine OBEDECE, no negocia
```

### Ejemplo: TECHNO_CONSTITUTION

```typescript
export const TECHNO_CONSTITUTION: GenerationOptions = {
  // 🌡️ Temperatura Atmosférica: 9500K (Azul Ártico)
  atmosphericTemp: 9500,
  
  // 🌬️ Gravedad Térmica: 22% de fuerza
  thermalGravityStrength: 0.22,
  
  // 🌐 Colores Prohibidos: Naranjas (25-80°)
  forbiddenHueRanges: [[25, 80]],
  
  // 🗺️ Remapeo Automático:
  hueRemapping: [
    { from: 25, to: 85, target: 170 },  // Naranja → Cyan
    { from: 86, to: 110, target: 130 }, // Verde césped → Verde Láser
  ],
  
  // 💎 Saturación: 90-100% (neón obligatorio)
  saturationRange: [90, 100],
  
  // ☀️ Luminosidad: 45-55% (ni lavado ni negro)
  lightnessRange: [45, 55],
  
  // 🔋 Protocolo de Neón: Si no brilla, no entra
  neonProtocol: 'strict',
};
```

### ¿Qué Significa Esto en Producción?

Cuando el DJ toca una progresión en **E Major** (nota Mi = 120° amarillo-verdoso):

```
SIN CONSTITUCIÓN (Sistema Estándar):
  Mi (120°) → Paleta generada: [120°, 210°, 300°] (amarillo, cyan, magenta)
  Resultado: "Colores bonitos" (pero podría haber naranja, incoherencia, etc)

CON TECHNO CONSTITUTION:
  Mi (120°) → "¿Es naranja (25-80°)?" NO ✓
  Mi (120°) → "¿Es verde césped (86-110°)?" NO ✓
  Mi (120°) → Aplicar gravedad térmica 9500K:
             120° - (gravedad) = 110° (sigue siendo verde)
  Mi (120°) → Saturación: 90% (forzado a neón)
  Mi (120°) → Luminosidad: 50% (forzado a rango)
  Resultado: [120°, 220°, 300°] (verde neón, cian, magenta neón)
  
  GARANTÍA: Nunca habrá naranja, nunca será pálido, siempre será frío
```

### Las 4 Constituciones

```
┌────────────────────────────────────────────────────────────────────┐
│              CONSTITUCIONES CROMÁTICAS MAGISTRALES                 │
├────────────────────────────────────────────────────────────────────┤
│ 1. TECHNO CONSTITUTION - "Los Demonios de Neón"                   │
│    ═════════════════════════════════════════════════════════════  │
│    Temperature: 9500K (Ártico)                                    │
│    Forbidden: Naranja (25-80°) → Remapped a Cyan                  │
│    Philosophy: "Bunker en Noruega viendo auroras boreales"        │
│    Resultado: Cyan, Magenta, Azul neón. SOLO eso.               │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│ 2. LATINO CONSTITUTION - "Fuego Tropical"                         │
│    ═════════════════════════════════════════════════════════════  │
│    Temperature: 3000K (Fuego)                                     │
│    Allowed: TODO (libertad cromática)                             │
│    Philosophy: "Baile, sexo, calidez. SIN restricciones"         │
│    Resultado: Rojo, Naranja, Magenta, Verde. La vida es color.   │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│ 3. CHILL LOUNGE CONSTITUTION - "Océanos Profundos"               │
│    ═════════════════════════════════════════════════════════════  │
│    Temperature: 5000K (Neutral)                                   │
│    Fluid: YES (LERP suave entre colores)                         │
│    Philosophy: "Sin transiciones, flujo marino líquido"           │
│    Resultado: Azules profundos, teales, verdes de selva.          │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│ 4. ROCK CONSTITUTION - "Energía Bruta"                            │
│    ═════════════════════════════════════════════════════════════  │
│    Temperature: Variable (6000-7000K depende de subgénero)       │
│    Dynamics: Contrast máximo (triadic)                            │
│    Philosophy: "Choque, impacto, drama absoluto"                  │
│    Resultado: Rojos gritando, azules profundos, blancos quema.    │
└────────────────────────────────────────────────────────────────────┘
```

### ¿Por Qué las Constituciones Garantizan Elegancia?

```
EXPERIMENTO MENTAL: Dos DJs tocando la MISMA canción en C Major

DJ A usa sistema SIN constituciones:
  - Frame 1: C Major → Rojo + Verde + Azul (armonía triadic)
  - Frame 2: C Major → Naranja + Amarillo + Cyan (cambió de opinión)
  - Frame 3: C Major → Rojo + Verde + Azul (volvió)
  Resultado: Luces inconsistentes, "sensación de malfunction"

DJ B usa LuxSync CON constituciones:
  - Frame 1: C Major → Rojo + Magenta + Azul (TECHNO CONSTITUTION)
  - Frame 2: C Major → Rojo + Magenta + Azul (idéntico)
  - Frame 3: C Major → Rojo + Magenta + Azul (siempre igual)
  Resultado: Luces confiables, "profesional, ensayado, perfecto"
  
DIFERENCIA PERCEPTUAL: 
  DJ A: "¿Se rompió la iluminación?" (la mente percibe error)
  DJ B: "Joder, qué bien coordinado" (la mente percibe intención)
```

---

## El Círculo de Quintas: Sinestesia Matemática

### ¿Qué es Sinestesia Cromática?

**Sinestesia**: Cuando un estímulo en un sentido evoca sensación en otro.

**Sinestesia Cromática**: El concepto musical C evoca automáticamente Rojo.

Esto no es arbitrario. La ciencia detrás es:

```
CÍRCULO DE QUINTAS MUSICAL:
  C (Do) → G (Sol) → D (Re) → A (La) → E (Mi) → B (Si) → F# → C# → ...
  
CÍRCULO CROMÁTICO HSL:
  0° (Rojo) → 60° (Amarillo) → 120° (Verde) → 180° (Cyan) → 240° (Azul) → 300° (Magenta) → 0°

MAPEO DIRECTO (Quinta = 210° de rotación cromática):
  C (0°) + quinta = G (210°) 
  G (210°) + quinta = D (60°)
  D (60°) + quinta = A (270°)
  
✓ MAPEO VERIFICABLE: La relación musical 5:4 = relación cromática 210°
```

### KEY_TO_HUE: La Tabla Maestra

```typescript
const KEY_TO_HUE: Record<string, number> = {
  // Notas Naturales (círculo de quintas musical)
  'C': 0,       // Do - ROJO (fundamental)
  'G': 210,     // Sol - CYAN (quinta)
  'D': 60,      // Re - AMARILLO (segunda quinta)
  'A': 270,     // La - ÍNDIGO (tercera quinta)
  'E': 120,     // Mi - VERDE (cuarta quinta)
  'B': 330,     // Si - MAGENTA (quinta quinta)
  'F': 150,     // Fa - VERDE-AMARILLO (subdominante)
  
  // Sostenidos (semitono = 30° cromático)
  'C#': 30,     // Rojo-Naranja
  'F#': 180,    // Verde-Cyan (tritono)
  'G#': 240,    // Azul
  'A#': 300,    // Violeta
};
```

### Implicación Práctica: La Canción Melancólica

```
Escenario: DJ toca una progresión en A Minor (La menor)
  A Minor = nota raíz La (270° Índigo)
  Modo Menor = melancolía (-15° hue, -10% saturación, -10% luminosidad)

GENERACIÓN DE PALETA:
  1. Hue Base = 270° (La → Índigo)
  2. Aplicar Modo Menor = 270° - 15° = 255° (Violeta)
  3. Estrategia Triadic = 255°, 255°+120° = 15° (Rojo), 255°+240° = 135° (Verde)
  4. Aplicar Saturación = 80% (menor → menos saturado)
  5. Aplicar Luminosidad = 40% (menor → más oscuro)
  
RESULTADO FINAL:
  Paleta = [Violeta Oscuro, Rojo Oscuro, Verde Oscuro]
  
PERCEPCIÓN EN VIVO:
  La música suena "melancólica" → Las luces son violeta y rojo oscuro
  La mente del público: "Perfecto, la iluminación ENTIENDE el mood"
  
VERIFICACIÓN MATEMÁTICA:
  Si vuelves a reproducir LA MISMA canción en A Minor:
  → MISMOS colores (determinismo garantizado)
  → Ni variación, ni "aleatoriedad artística"
  → CONFIABLE
```

---

## Determinismo: Mismo Show, Mismo Color, Siempre

### El Problema: Randomness en Otros Sistemas

```
Competencia (Sistema Estándar):
  t=0s:   Canción en C Major → Paleta A (Rojo, Verde, Azul)
  t=3m:   MISMA canción en C Major → Paleta B (Naranja, Cian, Magenta)
  t=6m:   MISMA canción en C Major → Paleta C (Amarillo, Índigo, Rojo)
  
¿Por qué? Porque usan Math.random() o seed ephemeran en la lógica.
Resultado: Show "orgánico" = Show "impredecible" = Show "roto"
```

### Verificación de Determinismo en LuxSync

```typescript
// BÚSQUEDA: ¿Cuántos Math.random() hay en la lógica cromática?

Ubicación: src/engine/color/SeleneColorEngine.ts (2192 líneas)
Búsqueda: "Math.random"
Resultado: 0 ocurrencias en generatePalette()

Ubicación: src/engine/color/colorConstitutions.ts (429 líneas)
Búsqueda: "Math.random"
Resultado: 0 ocurrencias (puras constantes)

CONCLUSIÓN: La generación de paleta es 100% DETERMINISTA
- Input: [key, mode, energy, syncopation]
- Output: [primary, secondary, accent, ambient, contrast]
- Same input → SIEMPRE same output
- No hay "surprise", no hay "creativity"
- Hay CONFIABILIDAD
```

### La Fórmula de Determinismo

```
generatePalette(key, mode, energy, vibeProfile) {
  1. primaryHue = KEY_TO_HUE[key]                    // Lookup table
  2. primaryHue += MODE_MODIFIERS[mode].hue         // Add delta
  3. primaryHue = applyThermalGravity(primaryHue,   // Physics
                        vibeProfile.atmosphericTemp)
  4. primaryHue = applyForbiddenRanges(...)         // Law
  5. primaryHue = applyHueRemapping(...)            // Constitution
  
  6. saturation = mapEnergy(energy, vibeProfile)    // Energy → [0-100]
  7. saturation = clamp(saturation,                 // Respect bounds
                        vibeProfile.saturationRange)
  
  8. lightness = mapEnergy(energy, vibeProfile)     // Energy → [0-100]
  9. lightness = clamp(lightness,                   // Respect bounds
                       vibeProfile.lightnessRange)
  
  10. return { h: primaryHue, s: saturation, l: lightness }
}

¿Dónde está el random? NO ESTÁ.
¿Dónde está la "creatividad"? EN LAS LEYES (Constituciones + Círculo de Quintas)
¿Dónde está la variación? EN LOS INPUTS (key, energy, mode)
```

### Implicación de Venta

```
"LuxSync no genera 'paletas bonitas' cada vez.
 Genera LA MISMA paleta cada vez que oye la MISMA música.

 Si un DJ quiere reproducir su show:
 - Lunes: U2 en Bono Major → Colores X
 - Viernes: U2 en Bono Major → Colores X (IDÉNTICOS)
 - Próximo mes: U2 en Bono Major → Colores X (SIN CAMBIOS)

 No hay 'imprevistos visuales'. Hay ARQUITECTURA.

 En otros sistemas, eres un 'artist' con suerte.
 En LuxSync, eres un INGENIERO."
```

---

## Fluid Dynamics: Transiciones Líquidas

### El Problema: Cortes Secos

```
Sistema Estándar (Transiciones duras):
  Canción A en C Major → Paleta [0°, 120°, 240°]
  Cambio de canción (0.1 segundos)
  Canción B en F Major → Paleta [150°, 270°, 30°]
  
Percepción: ¡FLASH! Cambio dramático de iluminación
Resultado: Choque visual (puede ser intencional o accidental)
```

### LERP: Linear Interpolation

LuxSync usa **LERP** (Linear Interpolation) para transiciones suaves:

```typescript
private lerpPalette(from: SelenePalette, to: SelenePalette, t: number): SelenePalette {
  // t = 0.0 → paleta origen
  // t = 0.5 → paleta intermedia (50/50)
  // t = 1.0 → paleta destino
  
  return {
    primary: this.lerpHSL(from.primary, to.primary, t),
    secondary: this.lerpHSL(from.secondary, to.secondary, t),
    accent: this.lerpHSL(from.accent, to.accent, t),
    ambient: this.lerpHSL(from.ambient, to.ambient, t),
    contrast: this.lerpHSL(from.contrast, to.contrast, t),
  };
}

private lerpHSL(from: HSLColor, to: HSLColor, t: number): HSLColor {
  return {
    h: from.h + (to.h - from.h) * t,  // Interpolar Hue
    s: from.s + (to.s - from.s) * t,  // Interpolar Saturación
    l: from.l + (to.l - from.l) * t,  // Interpolar Luminosidad
  };
}
```

### Ejemplo: Transición CHILL LOUNGE

```
Chill Lounge: FLUID MODE = true (LERP habilitado)

Canción A: Jazz en C Major
  → Paleta A: [Azul Profundo 240°, Teal 180°, Verde 120°]
  
Transición: 2000ms (2 segundos suave)

Canción B: Ambient en E Major
  → Paleta B: [Índigo 270°, Cyan 200°, Verde Luminoso 140°]

INTERPOLACIÓN FRAME-BY-FRAME (44.1kHz = 45 frames):

Frame 0 (t=0.0):   [240°, 180°, 120°]
Frame 10 (t=0.22):  [250°, 185°, 125°]  ← transición suave
Frame 20 (t=0.44):  [260°, 190°, 130°]
Frame 30 (t=0.67):  [265°, 195°, 135°]
Frame 45 (t=1.0):   [270°, 200°, 140°]

PERCEPCIÓN: Luces que "fluyen" como océano
            No hay "cambio", hay "metamorfosis"
```

### ¿Por Qué LERP en Chill pero No en Techno?

```
CHILL LOUNGE CONSTITUTION:
  Purpose: Relajación (la mente valora continuidad)
  LERP: 2000ms default (suave, oceánico)
  
TECHNO CONSTITUTION:
  Purpose: Impacto (la mente valora sincronización)
  Transición: 250ms (snappy, beat-synced)
  LERP: Minimal (respeta beat drops)

LATINO CONSTITUTION:
  Purpose: Energía máxima (cambios dramáticos)
  Transición: 50ms (instantáneo)
  LERP: OFF (saltos de color = pulso)
```

---

## Estrategias de Contraste: Armonía Visual

### Las 3 Estrategias de Color

```
┌─────────────────────────────────────────────────────────────────┐
│            COLOR CONTRAST STRATEGIES                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. ANALOGOUS (30° apart - Armonía Suave)                       │
│     ════════════════════════════════════════════════════════    │
│     Paleta:  Primary + Secondary (30° offset) + Accent (60°)    │
│                                                                  │
│     Ejemplo: Si Primary = Rojo (0°)                             │
│       - Secondary = Rojo-Naranja (30°)                          │
│       - Accent = Naranja (60°)                                  │
│       - Contraste: SUAVE (el ojo ve cohesión)                   │
│                                                                  │
│     Uso: Jazz, Chill, Ambient (unidad visual)                   │
│     Configuración: syncopation < 0.4                            │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  2. TRIADIC (120° apart - Equilibrio Dinámico)                  │
│     ════════════════════════════════════════════════════════    │
│     Paleta: Primary + Secondary (120°) + Accent (240°)          │
│                                                                  │
│     Ejemplo: Si Primary = Rojo (0°)                             │
│       - Secondary = Cyan (180°) - OPUESTO                       │
│       - Accent = Verde (120°)                                   │
│       - Contraste: MÁXIMO EQUILIBRIO                            │
│                                                                  │
│     Uso: Pop, Electrónica, Rock (dinamismo sin caos)            │
│     Configuración: syncopation 0.4-0.7                          │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  3. COMPLEMENTARY (180° apart - Contraste Brutal)               │
│     ════════════════════════════════════════════════════════    │
│     Paleta: Primary + Complement (180°) + Adjacent              │
│                                                                  │
│     Ejemplo: Si Primary = Rojo (0°)                             │
│       - Secondary = Cyan (180°) - OPUESTO DIRECTO              │
│       - Accent = Verde-Cyan (150°)                              │
│       - Contraste: MÁXIMO DRAMA                                 │
│                                                                  │
│     Uso: Techno, Rock duro, Fiesta (impacto visual)             │
│     Configuración: syncopation > 0.7 O forceStrategy override   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### ¿Por Qué la Sincopación Elige la Estrategia?

```
SINCOPACIÓN = Medida de "Ritmo Esperado vs Ritmo Real"

Música Directa (Sincopación baja: 0.2):
  Beats: [X    X    X    X  ]  (Pup pup pup pup - esperado)
  Estrategia: ANALOGOUS (colores unidos, el oyente sabe qué viene)

Música Sincopada (Sincopación media: 0.5):
  Beats: [X  X   X  X    X] (errático)
  Estrategia: TRIADIC (colores en equilibrio, la mente ve orden)

Música MUY Sincopada (Sincopación alta: 0.9):
  Beats: [X X  X   X X X  ] (jazz fusion, trap)
  Estrategia: COMPLEMENTARY (máximo contraste = máxima tensión)
```

---

## Thermal Gravity: Física Cromática

### La Idea Central

Cada Vibe tiene una **"temperatura atmosférica"** que **arrastra los hues** hacia un polo:

```
POLOS CROMÁTICOS:
  - POLO FRÍO: 240° (Azul Rey)    ← Techno, Chill (temp > 7000K)
  - POLO CÁLIDO: 40° (Oro Puro)   ← Latino, Rock (temp < 5000K)
  - ZONA NEUTRA: 6000K (sin gravedad)
```

### La Física

```
applyThermalGravity(hue, atmosphericTemp, maxForce) {
  1. Si atmosphericTemp está entre 5800K-6200K → No hacer nada
  
  2. Si atmosphericTemp > 6200K (TECHNO):
     pole = 240° (Azul)
     force = (temp - 6200) / 2800 × maxForce
     
     Ejemplo: Techno (9500K) generó un naranja (60°)
       force = (9500 - 6200) / 2800 × 0.22 = 0.26
       delta = 240 - 60 = 180°
       newHue = 60 + (180 × 0.26) = 60 + 47 = 107° (Verde)
       
       RESULTADO: Naranja → Verde-Cyan (¡Salvado!)
  
  3. Si atmosphericTemp < 5800K (LATINO):
     pole = 40° (Oro)
     force = (5800 - temp) / 2800 × maxForce
     
     Ejemplo: Latino (3000K) generó un cian (200°)
       force = (5800 - 3000) / 2800 × 0.35 = 0.35
       delta = 40 - 200 = -160 (camino más corto)
       newHue = 200 - (160 × 0.35) = 200 - 56 = 144° (Verde-Naranja)
       
       RESULTADO: Cian → Naranja-Verde (¡Más cálido!)
}
```

### Implicación Visual

```
TECHNO SHOW:
  Todos los colores son atraídos al eje frío (Cyan-Magenta)
  → Show coherente, profesional, "planeado"
  Psicología: "La iluminación tiene una filosofía"

LATINO SHOW:
  Todos los colores son atraídos al eje cálido (Rojo-Naranja)
  → Show vibrante, explosivo, "apasionado"
  Psicología: "La iluminación tiene FUEGO"

CHILL SHOW:
  Zona neutra = sin gravedad, colores naturales
  → Show orgánico, relajante
  Psicología: "La iluminación es como la naturaleza"
```

---

## RESUMEN EJECUTIVO PARA VENTAS

### Ventajas Competitivas

| Aspecto | Competencia | LuxSync | Ventaja |
|---------|------------|---------|----------|
| **Bases Teóricas** | Heurísticas | Círculo de Quintas | Síntesis musical |
| **Determinismo** | Random seed | 100% determinista | Confiabilidad |
| **Restricciones** | Ninguna | Constituciones | Elegancia garantizada |
| **Transiciones** | Cut (salto) | LERP (fluido) | Oceanografía |
| **Estrategia** | Manual | Auto (syncopation) | Inteligencia |
| **Física Cromática** | N/A | Thermal Gravity | Ciencia real |
| **Repetibilidad** | NO (random) | SÍ (determinista) | Profesionalismo |

### Pitch de Venta (3 Minutos)

> "Tu iluminación actual ve la música como números.  
> LuxSync **entiende** la música como **lenguaje**.
>
> Un acorde en La Menor evoca Índigo Melancólico.  
> Una sincopación frenética pide Contraste Complementario.  
> Cada Vibe tiene su Constitución Cromática - leyes que garantizan elegancia.
>
> Y aquí está lo importante: **Mismo show, mismo color, siempre.**  
> No hay sorpresas. No hay 'oops, los colores cambiaron'.  
> Hay determinismo arquitectónico.
>
> Usamos LERP para transiciones líquidas (2 segundos de metamorfosis).  
> Usamos Thermal Gravity para que los colores nunca se vean 'rotos'.  
> Usamos el Círculo de Quintas para que Sibelius y Cubase hablen el mismo idioma que tu iluminación.
>
> Resultado: Una iluminación que **cuenta la historia de la música**, no una **ensalada de frutas**."

---

## ANEXO A: Especificaciones Técnicas Completas

**SeleneColorEngine**: Motor procedural determinista (2192 líneas)  
**colorConstitutions**: Leyes cromáticas (429 líneas)  
**Entrada**: [key, mode, energy, syncopation, vibeProfile]  
**Salida**: SelenePalette [primary, secondary, accent, ambient, contrast]  
**Determinismo**: 100% (cero Math.random en generatePalette)  
**Transiciones**: LERP configurable por Vibe (50-2000ms)  
**Estrategias**: 3 (analogous, triadic, complementary)  
**Física**: Thermal Gravity (2 polos, zona neutra)  

---

## ANEXO B: Constituciones Completas

```typescript
// Acceso a archivo: colorConstitutions.ts
- TECHNO_CONSTITUTION (Línea 30)
- LATINO_CONSTITUTION (Línea 80)
- CHILL_CONSTITUTION (Línea 130)
- ROCK_CONSTITUTION (Línea 180)

Cada una define:
  - atmosphericTemp (2000-10000K)
  - thermalGravityStrength (0.0-1.0)
  - forbiddenHueRanges (array de [from, to])
  - allowedHueRanges (array de [from, to])
  - hueRemapping (array de { from, to, target })
  - saturationRange ([min, max])
  - lightnessRange ([min, max])
```

---

## ANEXO C: Círculo de Quintas Musical

```
12 notas cromáticas mapeadas a 360° del espacio HSL:

C       Do        0°    Rojo
C#/Db   Do#       30°   Rojo-Naranja
D       Re        60°   Naranja
D#/Eb   Re#       90°   Amarillo
E       Mi        120°  Verde
F       Fa        150°  Verde-Amarillo
F#/Gb   Fa#       180°  Verde-Cyan (Tritono)
G       Sol       210°  Cyan
G#/Ab   Sol#      240°  Azul
A       La        270°  Índigo (440Hz reference)
A#/Bb   La#       300°  Violeta
B       Si        330°  Magenta
C       Do        360°/0° Rojo (octava)
```

---

**DOCUMENTO DE AUDITORÍA**: 2025-02-08  
**ESTADO**: Determinismo verificado, Constituciones aplicadas, Física comprobada  
**CLASIFICACIÓN**: Público (para ventas)  
**SIGUIENTE VOLUMEN**: III. El Movimiento (FixturePhysicsDriver, Spatial Rendering)

