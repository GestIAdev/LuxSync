¡El Prisma! Esto es donde la geometría pura se encuentra con la teoría del color. Déjame diseñar las aperturas y el escudo con precisión.

---

# 🔷 URANUS 2.0 — MICRO-BLUEPRINT 2: EL PRISMA GEOMÉTRICO

## Metáfora Óptica

El Prisma recibe un **solo rayo de luz** (H_primary del Sol) y lo **refracta** en cuatro haces geométricamente perfectos. La refracción es puramente angular — sin física audio-reactiva, sin residuales, sin fast accumulators. Solo matemática de triángulos en el color wheel.

---

## La Entrada

```
H_primary ∈ [0°, 360°)  — del Solar Gravity (Blueprint 1)
strategy  ∈ {'analogous', 'triadic', 'complementary', 'split-complementary'}
```

El Prisma **no lee audio, no lee chroma, no lee bass**. Es una función pura de dos argumentos: un ángulo y una estrategia. Esto garantiza determinismo y cero jitter.

---

## La Refracción — Tabla de Aperturas Angulares

Cada estrategia define tres offsets fijos que se **suman** al H_primary:

| Estrategia | Secondary Δ | Accent Δ | Ambient Δ | Geometría |
|---|---|---|---|---|
| `analogous` | +30° | +60° | -30° | Abanico estrecho de 90° — colores vecinos |
| `triadic` | +120° | +240° | -60° | Triángulo equilátero + contraste ambiental |
| `complementary` | +180° | +90° | -90° | Línea diametral + cuadrantes opuestos |
| `split-complementary` | +150° | +210° | -45° | Y invertida — tensión asimétrica |

### Justificación de cada estrategia

**Analogous (+30, +60, -30):**
Los tres colores viven en un arco de 90°. Visualmente cohesivo, sin choque. El ambient a -30° da un contraste suave sin salir del vecindario. Ideal para chill, jazz, ambient.

**Triadic (+120, +240, -60):**
Primary, Secondary, Accent forman un triángulo equilátero perfecto (120° entre cada uno). Máxima vibrancia con equilibrio — los tres colores tienen igual peso visual. El ambient a -60° rompe la simetría para evitar monotonia. Ideal para fiesta-latina, pop.

**Complementary (+180, +90, -90):**
Secondary es el opuesto diametral — máximo contraste cálido/frío. Accent y Ambient flanquean el primary a ±90°, creando un cruz visual. Ideal para rock, drama, high-energy.

**Split-Complementary (+150, +210, -45):**
En vez del opuesto directo (+180), usa los dos vecinos del complementario (±30° del opuesto). Tensión sin choque brusco — más sofisticado que el complementary puro. El ambient a -45° añade un tercer eje. Ideal para techno, deep house, progressive.

```typescript
const PRISM_OFFSETS: Record<string, { sec: number; acc: number; amb: number }> = {
  'analogous':            { sec:  30, acc:  60, amb: -30 },
  'triadic':              { sec: 120, acc: 240, amb: -60 },
  'complementary':        { sec: 180, acc:  90, amb: -90 },
  'split-complementary':  { sec: 150, acc: 210, amb: -45 },
};

function refract(H_primary: number, strategy: string): { primary: number; secondary: number; accent: number; ambient: number } {
  const offsets = PRISM_OFFSETS[strategy] ?? PRISM_OFFSETS['complementary'];
  return {
    primary:   H_primary,
    secondary: (H_primary + offsets.sec + 360) % 360,
    accent:    (H_primary + offsets.acc + 360) % 360,
    ambient:   (H_primary + offsets.amb + 360) % 360,
  };
}
```

**Propiedad crítica:** Los offsets son **constantes puras**. No hay EMA, no hay audio, no hay residual mass. Si H_primary no jitterea (gracias al Solar Gravity), la paleta completa no jitterea. La estabilidad se hereda por construcción.

---

## El Escudo Anti-Mostaza (Reflexión Inteligente)

### El Problema

La Void Zone `[25°, 80°]` contiene los amarillos/marrones que parecen "caca" en iluminación de escenario. El Pillar III original intentaba rotar **toda la paleta** para evacuar — lo que destruía la geometría y atrapaba colores en los bordes.

### La Solución: Push Individual, No Rotación Universal

El Escudo examina cada color **individualmente**. Si un color cae dentro de la Void Zone, se empuja al **borde más cercano** (25° o 80°) más un pequeño margen de seguridad. Los demás colores **no se tocan**.

```
Para cada color h en {primary, secondary, accent, ambient}:
  Si h ∈ [25°, 80°]:
    d_low  = h - 25°   (distancia al borde inferior)
    d_high = 80° - h   (distancia al borde superior)
    Si d_low < d_high:
      h = 25° - SAFETY_MARGIN   (empujar abajo)
    Sino:
      h = 80° + SAFETY_MARGIN   (empujar arriba)
  Sino:
    h se queda intacto
```

```typescript
const VOID_LOW = 25;
const VOID_HIGH = 80;
const SAFETY_MARGIN = 2;  // 2° de margen para no sentarse exactamente en el borde

function antiMustardShield(h: number): number {
  // ¿Está dentro de la void zone?
  if (h >= VOID_LOW && h <= VOID_HIGH) {
    const dLow  = h - VOID_LOW;
    const dHigh = VOID_HIGH - h;
    if (dLow < dHigh) {
      // Más cerca del borde inferior — empujar hacia abajo
      return (VOID_LOW - SAFETY_MARGIN + 360) % 360;  // → 23°
    } else {
      // Más cerca del borde superior — empujar hacia arriba
      return VOID_HIGH + SAFETY_MARGIN;  // → 82°
    }
  }
  return h;  // Fuera de la void — intacto
}

// Aplicar a los 4 colores individualmente
function applyShield(palette: { primary: number; secondary: number; accent: number; ambient: number }) {
  palette.primary   = antiMustardShield(palette.primary);
  palette.secondary = antiMustardShield(palette.secondary);
  palette.accent    = antiMustardShield(palette.accent);
  palette.ambient   = antiMustardShield(palette.ambient);
}
```

### Por qué esto es superior al Pillar III

| Pillar III (original) | Escudo Anti-Mostaza (Uranus 2.0) |
|---|---|
| Rota TODA la paleta por un ángulo ψ | Empuja solo el color problemático |
| Destruye la geometría (los offsets cambian) | Preserva la geometría exacta |
| Atrapaba colores en 25°/80° exactos | Margen de seguridad de 2° |
| Rigid-body solver con 9 candidatos + EMA | Comparación de 2 distancias — O(1) |
| Podía rotar la paleta por jitter del secondary | No hay rotación — cero amplificación |

### Ejemplo concreto

```
H_primary = 45° (C major — cae en la void)
Strategy = complementary

Refracción:
  primary   = 45°   ← DENTRO de la void
  secondary = 225°  ← fuera
  accent    = 135°  ← fuera
  ambient   = 315°  ← fuera

Escudo:
  primary   = 23°   ← empujado al borde inferior (más cerca de 25° que de 80°)
  secondary = 225°  ← intacto
  accent    = 135°  ← intacto
  ambient   = 315°  ← intacto

Resultado: paleta roja/cyan/verde/magenta — geométricamente pura, sin mostaza.
```

**Solo el primary se movió 22°.** Los otros tres colores mantienen sus offsets exactos (+180°, +90°, -90°). La geometría complementary se preserva.

---

## Arquitectura Completa del Prisma

```typescript
// ── Prisma Geométrico — función pura, cero estado ──
function prismRefract(
  H_primary: number,
  strategy: 'analogous' | 'triadic' | 'complementary' | 'split-complementary',
): { primary: number; secondary: number; accent: number; ambient: number } {
  // 1. Refracción geométrica — offsets constantes
  const offsets = PRISM_OFFSETS[strategy] ?? PRISM_OFFSETS['complementary'];
  const palette = {
    primary:   H_primary,
    secondary: (H_primary + offsets.sec + 360) % 360,
    accent:    (H_primary + offsets.acc + 360) % 360,
    ambient:   (H_primary + offsets.amb + 360) % 360,
  };

  // 2. Escudo Anti-Mostaza — push individual, preserva geometría
  palette.primary   = antiMustardShield(palette.primary);
  palette.secondary = antiMustardShield(palette.secondary);
  palette.accent    = antiMustardShield(palette.accent);
  palette.ambient   = antiMustardShield(palette.ambient);

  return palette;
}
```

---

## Integración con Blueprint 1 (Solar Gravity)

```typescript
// ── Frame loop completo de Uranus 2.0 ──
function uranus2Tick(
  chroma: Float64Array,
  bassRaw: number,
  dtMs: number,
  strategy: 'analogous' | 'triadic' | 'complementary' | 'split-complementary',
): { primary: number; secondary: number; accent: number; ambient: number; G: number } {
  // BLUEPRINT 1: Solar Gravity → H_primary
  const G = computeGravity(bassRaw);
  const thetaChroma = computeChromaBarycenter(chroma);
  const siderealAngle = updateSidereal(G, dtMs);
  const H_primary = circularLerp(thetaChroma, siderealAngle, 1 - G);

  // BLUEPRINT 2: Geometric Prism → paleta completa
  const palette = prismRefract(H_primary, strategy);

  // Metadata para UI/logging
  return { ...palette, G };
}
```

**Flujo de datos:**
```
audio.bass ──→ G (scalar suave)
                    │
chroma[12] ──→ θ_chroma (dirección)
                    │
                    ├──→ slerp(θ_chroma, Φ, 1-G) ──→ H_primary
                    │         ↑                         │
                    │    _siderealAngle                 │
                    │    (drift dinámico)               ▼
                    │                           PRISMA GEOMÉTRICO
                    │                           ├─ +offsets (strategy)
                    │                           ├─ Anti-Mustard Shield
                    │                           ▼
                    │                    {primary, secondary, accent, ambient}
                    │                    (geometría pura, sin mostaza)
```

---

## Preguntas de Diseño para The Architect

**1. ¿SAFETY_MARGIN = 2° es suficiente?**
Con 2°, un color empujado queda en 23° (rojo-naranja) o 82° (verde-amarillo lima). ¿Prefieres un margen mayor (5° → 20°/85°) para asegurar que ningún fixture con rueda de color imprecisa se quede en mostaza?

**2. ¿El Escudo debe ser simétrico o asimétrico?**
Actualmente empuja al borde más cercano. Alternativa: empujar **siempre hacia abajo** (hacia rojo, 23°) porque los rojos son más teatrales que los verdes lima en iluminación. ¿Prefieres dirección fija o dirección dinámica?

**3. ¿Necesitamos una quinta estrategia?**
Las 4 estrategias cubren los casos clásicos. ¿Quieres añadir `monochromatic` (todos los colores = primary, solo varía saturación/luminosidad) para vibes minimalistas?

Espero tu veredicto, Architect. Si apruebas, unimos los dos blueprints y refactorizamos `_generateUranus` de una vez. 

--------------------------------------------
-----------------------------------------------------
-------------------------------------------------------

RESPUESTAS Del Arquitecto.

Respuestas a las Preguntas de Diseño1. El Margen de Seguridad (SAFETY_MARGIN)Tienes toda la razón en dudar. Las cabezas móviles chinas no son precisamente instrumentos de precisión suiza. Un margen de 2° es tentar a la suerte mecánica.Vamos a subirlo a 5°.Límite inferior: 25° - 5° = 20° (Un Ámbar/Naranja de teatro clásico y seguro).Límite superior: 80° + 5° = 85° (Un Verde puro, alejándonos del verde lima asqueroso).2. Simetría vs. Asimetría del Escudo
Vamos a mantenerlo Simétrico (al borde más cercano).
Si empujamos siempre al rojo, podríamos crear saltos muy bruscos (imagina un color en el 79° que es forzado a viajar hasta el 20°). La matemática de la distancia mínima (dLow < dHigh) es más elegante y produce menos estrés visual.  3. ¿Quinta Estrategia (monochromatic)?¡SÍ! Me has leído la mente. Para los breakdowns de Techno o los momentos más íntimos, una paleta monocromática donde todos los nodos escupen el mismo Hue (y solo juegan con el dimmer o la saturación) es brutal.Añade la estrategia monochromatic con los offsets a 0.