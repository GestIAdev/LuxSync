# 🤖 WAVE 96: NEON DEMONS (AURORA EDITION)

## CONTEXTO: TECHNO CLUB CYBERPUNK

Después de implementar la paleta cálida y tropical para **Fiesta Latina** (WAVE 85, 94.2, 94.3), ahora es momento de crear el opuesto absoluto: la estética **TECHNO CLUB** con colores fríos, neón y atmósfera UV.

**Filosofía**: "La oscuridad es el lienzo, el neón es la pintura"

---

## OBJETIVOS

1. ✅ **Espectro frío exclusivo**: Solo 160-320° (Verde → Cian → Azul → Magenta)
2. ✅ **Atmósfera UV**: Ambient violeta profundo (Black Light effect)
3. ✅ **Auroras Boreales**: Secondary con Rosas/Magentas eléctricos
4. ✅ **Toxic Waste**: Alternativa de Verde ácido/Lima
5. ✅ **Red Alert**: Override total en disonancia extrema

---

## ESTÉTICA: CYBERPUNK NEÓN

```
┌─────────────────────────────────────────────────────────┐
│  🌌 TECHNO CLUB VIBE                                    │
│                                                          │
│  AMBIENT:   🟣 Ultraviolet (275°) - Black Light UV      │
│  PRIMARY:   🔵 Cold Spectrum (170-302°) - Neón Vigas    │
│  SECONDARY: 🌈 Aurora (300-330°) o ☢️ Acid (110-140°)   │
│  ACCENT:    ⚪ White Ice (190° cyan tint) - Cegador     │
│                                                          │
│  DISONANCIA > 0.8 → 🔴 RED ALERT (todo rojo sangre)    │
└─────────────────────────────────────────────────────────┘
```

---

## IMPLEMENTACIÓN

### Ubicación
```
SeleneColorEngine.ts → generate() → Línea ~991
Después del bloque WAVE 85 (Fiesta Latina)
Antes del return final
```

### Código Completo

```typescript
// ═══════════════════════════════════════════════════════════════════════
// 🤖 WAVE 96: NEON DEMONS (AURORA EDITION) - TECHNO CLUB CYBERPUNK
// ═══════════════════════════════════════════════════════════════════════
const isTechnoVibe = vibeId === 'techno-club';

if (isTechnoVibe) {
  // 1️⃣ ULTRAVIOLET BASE (El Suelo - Black Light UV)
  ambient.h = 275;   // Indigo/Violeta
  ambient.s = 100;   // Saturación máxima (neón UV)
  ambient.l = 25;    // Muy oscuro, solo mancha el aire
  
  // 2️⃣ PRIMARY (La Estructura - Vigas Neón)
  const keyRoot = key ? (KEY_TO_ROOT[key] ?? 0) : 0;
  const coldHue = 170 + (keyRoot * 12);  // Map 0-11 → 170-302°
  
  primary.h = normalizeHue(coldHue);
  primary.s = 100;   // Neón puro
  primary.l = 50;    // Color sólido
  
  // 3️⃣ SECONDARY (Aurora & Acid)
  const useAurora = (keyRoot % 5) >= 2;  // Determinístico
  
  if (useAurora) {
    // 🌌 AURORA BOREALIS: Rosa/Magenta (300-330°)
    secondary.h = 300 + ((keyRoot * 5) % 30);
  } else {
    // ☢️ TOXIC WASTE: Verde Ácido (110-140°)
    secondary.h = 110 + ((keyRoot * 5) % 30);
  }
  
  secondary.s = 100;  // Electricidad pura
  secondary.l = 65;   // Casi neón puro
  
  // 4️⃣ ACCENT (Strobes - White Ice)
  accent.h = 190;   // Cyan tint
  accent.s = 10;    // Casi blanco
  accent.l = 100;   // Cegador total
  
  // 5️⃣ RED ALERT (Override Disonancia > 0.8)
  const dissonance = wave8?.harmony?.dissonance ?? 0;
  if (dissonance > 0.8) {
    primary.h = 0;     // Rojo sangre
    primary.s = 100;
    primary.l = 45;
    secondary.h = 0;
    secondary.s = 100;
    secondary.l = 60;
    ambient.h = 0;
    ambient.s = 90;
    ambient.l = 20;    // Rojo opresivo
  }
}
```

---

## PALETAS POR KEY (Ejemplos)

### A Minor (Boris Brejcha - "Gravity")
```
keyRoot = 9
coldHue = 170 + (9 * 12) = 278° (Violeta)
useAurora = (9 % 5) = 4 >= 2 → TRUE

PRIMARY:   🟣 Violeta (278°, S=100, L=50)
SECONDARY: 🌺 Magenta Aurora (345°, S=100, L=65)
AMBIENT:   🟣 UV Violeta (275°, S=100, L=25)
ACCENT:    ⚪ White Ice (190°, S=10, L=100)
```

### D Minor (Charlotte de Witte - "Selected")
```
keyRoot = 2
coldHue = 170 + (2 * 12) = 194° (Cian)
useAurora = (2 % 5) = 2 >= 2 → TRUE

PRIMARY:   🔵 Cian (194°, S=100, L=50)
SECONDARY: 🌺 Rosa Aurora (310°, S=100, L=65)
AMBIENT:   🟣 UV Violeta (275°, S=100, L=25)
ACCENT:    ⚪ White Ice (190°, S=10, L=100)
```

### E Minor (Amelie Lens - "Feel It")
```
keyRoot = 4
coldHue = 170 + (4 * 12) = 218° (Azul)
useAurora = (4 % 5) = 4 >= 2 → TRUE

PRIMARY:   🔵 Azul (218°, S=100, L=50)
SECONDARY: 🌺 Magenta Aurora (320°, S=100, L=65)
AMBIENT:   🟣 UV Violeta (275°, S=100, L=25)
ACCENT:    ⚪ White Ice (190°, S=10, L=100)
```

### C Major (Techno track neutral)
```
keyRoot = 0
coldHue = 170 + (0 * 12) = 170° (Cian-Verde)
useAurora = (0 % 5) = 0 >= 2 → FALSE

PRIMARY:   🟢 Cian-Verde (170°, S=100, L=50)
SECONDARY: ☢️ Verde Ácido (110°, S=100, L=65)
AMBIENT:   🟣 UV Violeta (275°, S=100, L=25)
ACCENT:    ⚪ White Ice (190°, S=10, L=100)
```

---

## CARACTERÍSTICAS TÉCNICAS

### 1. Espectro Frío Forzado

```typescript
const coldHue = 170 + (keyRoot * 12);  // 170-302°
```

| keyRoot | coldHue | Color |
|---------|---------|-------|
| 0 (C) | 170° | 🟢 Cian-Verde |
| 2 (D) | 194° | 🔵 Cian |
| 4 (E) | 218° | 🔵 Azul |
| 5 (F) | 230° | 🔵 Azul Profundo |
| 7 (G) | 254° | 🟣 Violeta-Azul |
| 9 (A) | 278° | 🟣 Violeta |
| 11 (B) | 302° | 🟣 Magenta-Violeta |

**Garantía**: Nunca aparecen rojos (0°), naranjas (30°) o amarillos (60°)

---

### 2. Aurora vs Acid (Determinístico)

```typescript
const useAurora = (keyRoot % 5) >= 2;
```

| keyRoot | % 5 | ≥ 2? | Resultado |
|---------|-----|------|-----------|
| 0 (C) | 0 | ❌ | ☢️ ACID |
| 1 (C#) | 1 | ❌ | ☢️ ACID |
| 2 (D) | 2 | ✅ | 🌌 AURORA |
| 3 (D#) | 3 | ✅ | 🌌 AURORA |
| 4 (E) | 4 | ✅ | 🌌 AURORA |
| 5 (F) | 0 | ❌ | ☢️ ACID |
| 7 (G) | 2 | ✅ | 🌌 AURORA |
| 9 (A) | 4 | ✅ | 🌌 AURORA |

**Distribución**: ~60% Aurora, ~40% Acid

---

### 3. Ambient UV (Black Light Effect)

```typescript
ambient.h = 275;   // Violeta fijo (no varía con key)
ambient.s = 100;   // Saturación máxima
ambient.l = 25;    // Muy oscuro (antes era 15, subido para visibilidad)
```

**Propósito**: Simula la atmósfera de Black Light UV en un club techno. No es un color decorativo, es la **base atmosférica** sobre la que todo lo demás brilla.

---

### 4. Red Alert (Panic Mode)

```typescript
if (dissonance > 0.8) {
  // Todo se vuelve ROJO SANGRE
  primary.h = 0;
  secondary.h = 0;
  ambient.h = 0;
}
```

**Trigger**: Disonancia armónica > 0.8  
**Efecto**: Override total, toda la paleta se convierte en rojo opresivo  
**Uso**: Drops caóticos, glitches, buildups extremos

---

## COMPARATIVA: FIESTA LATINA vs TECHNO CLUB

| Aspecto | Fiesta Latina (WAVE 85) | Techno Club (WAVE 96) |
|---------|-------------------------|------------------------|
| **Espectro** | 🔥 Cálido (0-60°) | ❄️ Frío (170-302°) |
| **Ambient** | 🌊 Complementario dinámico | 🟣 UV fijo (275°) |
| **Secondary** | 🌴 Tropical Mirror (+180°) | 🌌 Aurora/Acid específico |
| **Saturación** | 70-100% (vibrante) | 100% siempre (neón) |
| **Lightness** | 40-60% (cálido visible) | 25-65% (oscuro con picos) |
| **Accent** | ✨ Blanco dorado (S=10, L=95) | ⚪ White Ice (S=10, L=100) |
| **Override** | ❌ Ninguno | 🔴 Red Alert (dissonance) |

---

## CASOS DE USO

### ✅ CASO 1: Boris Brejcha - "Gravity" (A minor)
**Características**: Techno melódico, 138 BPM, disonancia baja  
**Paleta Esperada**:
- Primary: 🟣 Violeta (278°) - Vigas neón
- Secondary: 🌺 Magenta Aurora (345°) - Láseres
- Ambient: 🟣 UV (275°) - Atmósfera
- Accent: ⚪ White Ice - Strobes

### ✅ CASO 2: Charlotte de Witte - "Selected" (D minor)
**Características**: Dark techno, 135 BPM, disonancia media  
**Paleta Esperada**:
- Primary: 🔵 Cian (194°) - Estructura
- Secondary: 🌺 Rosa Aurora (310°) - Contraste
- Ambient: 🟣 UV (275°) - Base oscura
- Accent: ⚪ White Ice - Flashes

### ✅ CASO 3: Amelie Lens - "Feel It" (E minor, DROP caótico)
**Características**: Hard techno, 145 BPM, **dissonance > 0.8**  
**Paleta Esperada (RED ALERT)**:
- Primary: 🔴 Rojo Sangre (0°)
- Secondary: 🔴 Rojo Brillante (0°)
- Ambient: 🔴 Rojo Opresivo (0°, L=20)
- Accent: ⚪ White Ice (sin cambio)

---

## INTEGRACIÓN CON SISTEMA EXISTENTE

### ✅ No afecta otros vibes
```typescript
if (isTechnoVibe) {
  // Solo se ejecuta si vibeId === 'techno-club'
}
```

### ✅ Usa KEY_TO_ROOT existente
```typescript
const keyRoot = key ? (KEY_TO_ROOT[key] ?? 0) : 0;
```

### ✅ Compatible con TROPICAL MIRROR
El bloque de Fiesta Latina (WAVE 85) se ejecuta **ANTES**, así que no hay conflicto.

### ✅ Respeta normalizeHue
```typescript
primary.h = normalizeHue(coldHue);  // Garantiza 0-359
```

---

## ARCHIVOS MODIFICADOS

```
✅ electron-app/src/main/selene-lux-core/engines/visual/SeleneColorEngine.ts
   - Líneas 991-1060: WAVE 96: NEON DEMONS (AURORA EDITION)
   - Bloque if (isTechnoVibe) { ... }
   - Usa KEY_TO_ROOT para mapeo de key a root numérico
   - Red Alert override en dissonance > 0.8

✅ docs/wave40_50/WAVE-96-NEON-DEMONS.md
   - Documentación completa de paletas Techno Club
   - Tabla comparativa Fiesta Latina vs Techno Club
   - Casos de uso con artistas reales (Boris Brejcha, Charlotte de Witte)
```

---

## PRÓXIMOS PASOS SUGERIDOS

1. **Prueba con música real**:
   - Boris Brejcha - "Gravity" (A minor, melódico)
   - Charlotte de Witte - "Selected" (D minor, dark)
   - Amelie Lens - "Feel It" (E minor, hard techno)

2. **Ajustar ambient.l si es necesario**:
   - Actual: `L=25` (oscuro visible)
   - Más oscuro: `L=15` (casi invisible, solo mancha)
   - Más visible: `L=35` (más presente)

3. **Experimentar con Red Alert threshold**:
   - Actual: `dissonance > 0.8`
   - Más sensible: `dissonance > 0.7`
   - Más restrictivo: `dissonance > 0.9`

---

## FECHA: Enero 2025
## STATUS: ✅ IMPLEMENTADO
## VIBE: techno-club
## COLORES: 🤖 CYBERPUNK NEÓN 🌌
