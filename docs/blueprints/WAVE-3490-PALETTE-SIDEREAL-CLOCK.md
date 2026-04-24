# WAVE 3490 — SIDEREAL CLOCK
## Blueprint: Paletas Durables + Constitución Latino Reformada

**Módulos objetivo:**
- `electron-app/src/engine/color/colorConstitutions.ts`
- `electron-app/src/engine/color/SeleneColorEngine.ts`

**Autor:** PunkOpus / Lead Architect  
**Estado:** Blueprint — PENDIENTE DE EJECUCIÓN  
**Prioridad:** CRÍTICA (show en 24h)  
**Filosofía:** Cambiar el algoritmo ANTES de la generación, no el output.

---

## 1. DIAGNÓSTICO RAÍZ

### Por qué el amarillo-naranja domina en Latino

El pipeline actual tiene **tres fuentes de sesgo cálido que se acumulan**:

```
1. TROPICAL BIAS (línea ~1107):
   Si key está en zona fría (150-270°), se rota a naranja (30-59°) o magenta (300-329°).
   → Cualquier key "fría" (G=210°, A=270°, F=150°) se fuerza a naranja.

2. THERMAL GRAVITY atmosphericTemp: 3500K (LATINO_CONSTITUTION):
   Polo cálido en 40° (Oro/Ámbar) con fuerza 0.22.
   → Todo lo que no esté ya en zona cálida recibe un empuje hacia el oro.

3. lightnessRange: [50, 70] + saturationRange: [80, 100]:
   Siempre brillante, nunca oscuro.
   → Imposible tener una paleta con profundidad y misterio.
```

El resultado matemático:  
`key fría → Tropical Bias → naranja → Thermal Gravity (cálido) → naranja más intenso → lightness alto → amarillo-naranja explosivo`.

Las tres fuerzas apuntan al mismo punto del círculo. La paleta no tiene escapatoria.

---

## 2. EL SIDEREAL CLOCK — Concepto

Un reloj sidéreo (estelar) mide el tiempo por la rotación de la Tierra respecto a las estrellas fijas, no respecto al Sol. Es absolutamente regular, completamente autónomo, y nunca se detiene.

El **Palette Sidereal Clock** hace lo mismo con los colores: un contador de tiempo que avanza de slot en slot sin depender de la key, el mood, ni ningún arbiter. Es independiente del audio. Determina ANTES de la generación qué zona del espectro está "activa" en este momento, y el motor la usa como restricción de entrada.

**No genera color.** Solo restringe el espacio de búsqueda. El motor sigue siendo el motor.

### Mecánica

```
PALETTE_SLOTS_LATINO: array de N "zonas de hue permitidas"
SLOT_DURATION_MS: duración por slot en milisegundos (ej. 4 minutos = 240.000ms)

slotIndex = Math.floor(Date.now() / SLOT_DURATION_MS) % N

slot activo → reemplaza (o refina) allowedHueRanges en la constitución
```

El `slotIndex` cambia exactamente cada `SLOT_DURATION_MS`. Sin frames, sin lerp, sin EMA. El interpolador LERP de 4s (ya existente en SeleneColorInterpolator) hace la transición suave automáticamente cuando el ColorEngine genera una nueva paleta en el slot nuevo.

**Es enteramente determinista:** el mismo timestamp produce el mismo slot en cualquier máquina.

---

## 3. REFORMA DE LATINO_CONSTITUTION

### 3.1 Eliminar el Tropical Bias

El Tropical Bias (WAVE 162) es el primer problema. Fuerza cada key fría a naranja o magenta. Con el Sidereal Clock ya gestionando los rangos cromáticos, el Tropical Bias es redundante y destructivo. Se puede **eliminar o desactivar** añadiendo un flag en `GenerationOptions`.

**Opción elegante:** Añadir `suppressTropicalBias: boolean` a `GenerationOptions`. El motor lo respeta.

### 3.2 Nueva temperatura térmica: neutral

Cambiar `atmosphericTemp: 3500` (polo cálido) a `atmosphericTemp: 6200` (zona neutra: 5000-7000K = sin gravedad apreciable). La gravedad térmica ya no empujará todo hacia el oro. El Sidereal Clock decide la zona, no la temperatura.

### 3.3 Nuevo lightnessRange: oscuridad real

```typescript
// ANTES:
lightnessRange: [50, 70],   // Siempre brillante

// DESPUÉS:
lightnessRange: [35, 60],   // Oscuridad disponible (35% = color profundo, no negro)
```

### 3.4 El dorado como accent permanente — no como primary

El dorado no desaparece. Se ancla en el `solarFlareAccent` que ya existe. Los PAR de accent siguen siendo dorados. Pero el primary y secondary dejan de estar condenados al naranja-amarillo. El dorado es una joya, no una pintura general.

### 3.5 Nueva forbiddenHueRanges: prohibir el amarillo puro también

```typescript
// ANTES:
forbiddenHueRanges: [
  [55, 85],    // BARRO
  [160, 180],  // VERDE BESUGO
  [260, 280],  // UV INDUSTRIAL
],

// DESPUÉS:
forbiddenHueRanges: [
  [45, 90],    // BARRO + AMARILLO PURO: 45° ya es amarillo-naranja invasivo
  [155, 185],  // VERDE BESUGO ampliado
  [255, 285],  // UV INDUSTRIAL ampliado
],
```

El naranja pasional (0-44°) y el magenta (300-360°) siguen libres.  
El agua caribeña (190-255°) sigue libre.  
La selva (90-155°) sigue libre.  
Solo el amarillo puro y sus derivados sucios quedan prohibidos.

---

## 4. LOS SLOTS DEL RELOJ

### Diseño de las 6 fases de un set de Latino moderno

La idea no es "fiesta de colores". Es **escenografía cinematográfica** para 300 personas. Un set tiene actos, no tonos únicos.

```
SLOT 0 — "ENTRADA" (0-4min): Azul Caribeño profundo
  allowedHueRanges: [[190, 250]]   // Agua del Caribe a las 3am
  lightnessRange:   [35, 50]       // Oscuro. El escenario se está preparando.

SLOT 1 — "ASCENSO" (4-8min): Verde Selva + Agua
  allowedHueRanges: [[90, 190]]    // Verde palma, turquesa, agua
  lightnessRange:   [40, 55]

SLOT 2 — "FUEGO" (8-12min): Rojo y Magenta — La pasión
  allowedHueRanges: [[0, 45], [300, 360]]   // Rojo-naranja pasional + Magenta
  lightnessRange:   [40, 60]

SLOT 3 — "APEX" (12-16min): Pleno espectro caribeño + brillo
  allowedHueRanges: [[0, 360]]    // Todo el Caribe permitido (solo rigen los forbiddenHueRanges)
  lightnessRange:   [45, 62]      // El pico de energía — más brillante que el resto

SLOT 4 — "DESCENSO" (16-20min): Magentas y violetas tropicales
  allowedHueRanges: [[285, 360]]  // Flores tropicales, atardecer, maracuyá
  lightnessRange:   [38, 55]

SLOT 5 — "RESOLUCIÓN" (20-24min): Azul nocturno + verde profundo
  allowedHueRanges: [[195, 255]]  // Noche caribeña
  lightnessRange:   [35, 48]      // De vuelta a la oscuridad eleganteO
```

El ciclo completo dura **24 minutos**. Luego vuelve a empezar desde el principio — sin que el público lo note, porque el set de música habrá cambiado también.

### Nota sobre Techno

Techno no necesita slots: ya tiene la Neon Protocol + Thermal Gravity haciendo un trabajo consistente. Solo se reforma Latino en esta wave.

---

## 5. IMPLEMENTACIÓN TÉCNICA

### 5.1 Nuevos campos en `GenerationOptions`

En `SeleneColorEngine.ts`, en la interfaz `GenerationOptions`:

```typescript
/**
 * WAVE 3490 — SIDEREAL CLOCK
 * Array de slots cromáticos con duración configurable.
 * Cada slot define allowedHueRanges y lightnessRange que reemplazan
 * los de la constitución base durante ese período de tiempo.
 * El slot activo se determina por Math.floor(Date.now() / slotDurationMs) % slots.length
 */
siderealClock?: {
  slotDurationMs: number;
  slots: Array<{
    allowedHueRanges: [number, number][];
    lightnessRange: [number, number];
    label?: string;  // Solo para logging/debug
  }>;
};

/**
 * WAVE 3490 — Suprime el Tropical Bias (WAVE 162) en el pipeline.
 * Cuando es true, las keys frías no se rotan a naranja/magenta.
 * Útil cuando el Sidereal Clock ya gestiona la zona cromática activa.
 */
suppressTropicalBias?: boolean;
```

### 5.2 Lógica del Sidereal Clock en `generate()`

Se añade UNA función pura (sin estado, sin efectos) antes del pipeline constitucional:

```typescript
/**
 * WAVE 3490 — SIDEREAL CLOCK RESOLVER
 * Determina el slot activo y devuelve los rangos de override.
 * Función pura: mismo timestamp → mismo resultado siempre.
 */
function resolveSiderealSlot(
  clock: NonNullable<GenerationOptions['siderealClock']>
): { allowedHueRanges: [number, number][]; lightnessRange: [number, number] } | null {
  if (!clock.slots || clock.slots.length === 0) return null;
  const slotIndex = Math.floor(Date.now() / clock.slotDurationMs) % clock.slots.length;
  const slot = clock.slots[slotIndex];
  return {
    allowedHueRanges: slot.allowedHueRanges,
    lightnessRange: slot.lightnessRange,
  };
}
```

En el pipeline de `generate()`, justo **antes** de que se construya `options.allowedHueRanges` y `options.lightnessRange` (antes de la Constitutional Enforcement), se añade:

```typescript
// WAVE 3490 — SIDEREAL CLOCK: Override de rangos antes de la constitución
// Nota: no reemplaza forbiddenHueRanges ni la Thermal Gravity.
// Solo restringe el allowedHueRanges y ajusta el lightnessRange del slot activo.
let effectiveOptions = options;
if (options?.siderealClock) {
  const slotOverride = resolveSiderealSlot(options.siderealClock);
  if (slotOverride) {
    effectiveOptions = {
      ...options,
      allowedHueRanges: slotOverride.allowedHueRanges,
      lightnessRange:   slotOverride.lightnessRange,
    };
  }
}
```

A partir de aquí, todo el pipeline usa `effectiveOptions` en lugar de `options`. Los `forbiddenHueRanges`, `hueRemapping`, `thermalGravityStrength` y `atmosphericTemp` de la constitución base siguen activos. El Sidereal Clock solo reemplaza **dónde puede estar el color**, no cómo se procesa.

### 5.3 Tropical Bias: suprimir limpiamente

En `generate()`, en el bloque de TROPICAL BIAS (circa línea 1107):

```typescript
// ANTES:
if (isLatinoHueFree && baseHue >= 150 && baseHue <= 270) {
  // ... rotación forzada
}

// DESPUÉS:
if (isLatinoHueFree && !options?.suppressTropicalBias && baseHue >= 150 && baseHue <= 270) {
  // ... rotación forzada (solo si no está suprimida)
}
```

Un `!` y una consulta a options. Sin borrar nada. El código antiguo sigue ahí, desactivable por config.

### 5.4 LATINO_CONSTITUTION actualizada

```typescript
export const LATINO_CONSTITUTION: GenerationOptions = {
  forceStrategy: undefined,
  
  // WAVE 3490: Neutralizar la gravedad cálida — ya no empujamos todo al oro.
  // 6200K = zona neutra (5000-7000K). Sin polo. El Sidereal Clock decide la zona.
  atmosphericTemp: 6200,
  thermalGravityStrength: 0.12,  // Fuerza reducida (0.22 → 0.12)
  
  // WAVE 3490: Amarillo puro ahora prohibido (antes solo barro 55-85).
  // El naranja pasional (0-44°) y magenta siguen libres.
  forbiddenHueRanges: [
    [45, 90],    // AMARILLO + BARRO: 45° es ya el límite del naranja pasional
    [155, 185],  // VERDE BESUGO (ampliado desde 160-180)
    [255, 285],  // UV INDUSTRIAL (ampliado desde 260-280)
  ],
  
  allowedHueRanges: [[0, 360]],  // El Sidereal Clock refina esto dinámicamente
  elasticRotation: 20,
  
  // WAVE 3490: Oscuridad disponible. El floor baja a 35%.
  saturationRange: [75, 100],
  lightnessRange: [35, 60],     // Era [50, 70]. Ahora hay profundidad.
  
  // WAVE 3490: Suprimir el Tropical Bias. El Sidereal Clock gestiona la zona.
  suppressTropicalBias: true,
  
  mudGuard: {
    enabled: true,
    swampZone: [45, 90],       // Actualizado para coincidir con new forbiddenHueRanges
    minLightness: 50,
    minSaturation: 80,
  },
  
  tropicalMirror: true,
  
  // El dorado permanece como accent — su trono, no su dictadura.
  accentBehavior: 'solar-flare',
  solarFlareAccent: { h: 35, s: 100, l: 55 },
  
  dimmingConfig: {
    floor: 0.08,
    ceiling: 1.0,
  },
  
  // WAVE 3490: EL RELOJ SIDÉREO
  // 6 actos × 4 minutos = ciclo de 24 minutos.
  // El lightnessRange base de la constitución aplica si el slot no lo define.
  siderealClock: {
    slotDurationMs: 4 * 60 * 1000,  // 4 minutos por slot
    slots: [
      {
        label: 'ENTRADA — Azul Caribeño Profundo',
        allowedHueRanges: [[190, 255]],
        lightnessRange: [35, 50],
      },
      {
        label: 'ASCENSO — Verde Selva y Agua',
        allowedHueRanges: [[90, 190]],
        lightnessRange: [40, 55],
      },
      {
        label: 'FUEGO — Rojo Pasional y Magenta',
        allowedHueRanges: [[0, 44], [300, 360]],
        lightnessRange: [40, 60],
      },
      {
        label: 'APEX — Caribe Completo',
        allowedHueRanges: [[0, 360]],   // Todo el Caribe (solo rigen los forbidden)
        lightnessRange: [45, 62],
      },
      {
        label: 'DESCENSO — Flores Tropicales',
        allowedHueRanges: [[285, 360]],
        lightnessRange: [38, 55],
      },
      {
        label: 'NOCHE — Azul Nocturno Profundo',
        allowedHueRanges: [[195, 255]],
        lightnessRange: [35, 48],
      },
    ],
  },
};
```

---

## 6. PUNTOS DE INSERCIÓN EN EL CÓDIGO

### En `GenerationOptions` (interfaz en SeleneColorEngine.ts)

Buscar el bloque de la interfaz `GenerationOptions` y añadir al final los dos campos nuevos: `siderealClock` y `suppressTropicalBias`.

### En `generate()` (SeleneColorEngine.ts)

**Punto 1 — Tropical Bias (circa línea 1107):**
```
// Antes:
if (isLatinoHueFree && baseHue >= 150 && baseHue <= 270) {

// Después:
if (isLatinoHueFree && !options?.suppressTropicalBias && baseHue >= 150 && baseHue <= 270) {
```

**Punto 2 — Justo antes de Constitutional HUE ENFORCEMENT (circa línea 1165):**
```typescript
// [INSERTAR AQUÍ: resolveSiderealSlot + effectiveOptions]
// Reemplazar todas las referencias a `options` en el bloque Constitutional
// por `effectiveOptions`.
```

El bloque Constitutional ya usa `options?.allowedHueRanges`, `options?.forbiddenHueRanges`, etc.
Con `effectiveOptions` en lugar de `options`, el override de slot es automático.

**Punto 3 — Lightness/Saturation clamps (circa línea 1355):**
```typescript
// Las líneas que construyen satMin/satMax/lightMin/lightMax
// también deben leer de effectiveOptions:
const satMin   = effectiveOptions?.saturationRange?.[0] ?? 70;
const satMax   = effectiveOptions?.saturationRange?.[1] ?? 100;
const lightMin = effectiveOptions?.lightnessRange?.[0]  ?? 35;
const lightMax = effectiveOptions?.lightnessRange?.[1]  ?? 60;
```

### En `colorConstitutions.ts`

Reemplazar `LATINO_CONSTITUTION` completa según la sección 5.4 del blueprint.

---

## 7. GARANTÍAS DE ARQUITECTURA

1. **Axioma Anti-Simulación**: `Math.floor(Date.now() / slotDurationMs) % N` es completamente determinista. No hay `Math.random()`. El mismo instante de tiempo produce el mismo slot en cualquier CPU.

2. **El motor sigue siendo el motor**: `forbiddenHueRanges`, `thermalGravity`, `hueRemapping`, `Neon Protocol`, `Constitutional Enforcement` — todo sigue activo. El Sidereal Clock solo restringe `allowedHueRanges` antes de entrar al pipeline. Nada se bypasea.

3. **Movers completamente al margen**: el pipeline de movers usa `MovementEngine.ts`, no recibe paletas de color. Los slots operan sobre el `primary` (PAR frontales) y `secondary`/`ambient` (PAR traseros/movers de LED). Las ruedas de color mecánicas solo cambian cuando el show operator lo decide. El Sidereal Clock no las toca.

4. **Sin estado adicional en el engine**: `resolveSiderealSlot` es función pura. `SeleneColorEngine` no acumula ninguna nueva variable de instancia. El slot se calcula en cada llamada a `generate()`.

5. **Degradación elegante**: si `siderealClock` es `undefined` (como en Techno, Rock, Chill), el motor funciona exactamente igual que antes. Cero regresión.

6. **El dorado sobrevive**: `solarFlareAccent: { h: 35 }` permanece intacto. Cuando el slot activo es "FUEGO" (allowedHueRanges: [[0, 44]]), el primary también puede ser naranja-rojo pasional. El dorado y el fuego coexisten de forma natural en esa fase.

---

## 8. CALIBRACIÓN DE TIEMPOS

Los `slotDurationMs` son completamente ajustables sin recompilar nada (solo cambiar el número en `colorConstitutions.ts`). Para el show de mañana, se recomiendan estos valores iniciales:

| Escenario | slotDurationMs | Ciclo total |
|---|---|---|
| Show largo (4h+) | 4 × 60 × 1000 (4 min) | 24 min |
| Show medio (2h) | 3 × 60 × 1000 (3 min) | 18 min |
| Show corto (1h) | 2 × 60 × 1000 (2 min) | 12 min |

El DJ nunca lo nota. El público nunca lo nota. Solo percibe que la sala "respira" con personalidad durante toda la noche.

---

## 9. CHECKLIST DE IMPLEMENTACIÓN

- [ ] 1. Añadir `siderealClock` y `suppressTropicalBias` a `GenerationOptions` interface
- [ ] 2. Añadir función pura `resolveSiderealSlot()` antes de la clase `SeleneColorEngine`
- [ ] 3. Añadir bloque de override `effectiveOptions` en `generate()` antes de Constitutional
- [ ] 4. Migrar referencias `options` → `effectiveOptions` en satMin/satMax/lightMin/lightMax clamps
- [ ] 5. Añadir `!options?.suppressTropicalBias` en el bloque Tropical Bias
- [ ] 6. Reemplazar `LATINO_CONSTITUTION` en `colorConstitutions.ts`
- [ ] 7. `npx tsc` → TSC_EXIT=0
- [ ] 8. Commit: `"WAVE 3490: Sidereal Clock + Latino Constitution Reform"`

---

## 10. NOTAS FINALES

El nombre "Sidereal Clock" es exacto: el reloj sidéreo astronómico es el único reloj que nunca pierde el paso porque no depende de la posición del Sol (el audio), solo de la rotación de la Tierra (el tiempo). Aquí el sistema de color no depende de la key ni del mood. Solo del tiempo. Implacable. Elegante.

La reforma de la constitución es la verdadera revolución. El Sidereal Clock es solo la guinda: sin la reforma, los slots seguirían siendo naranja con diferentes nombres.
