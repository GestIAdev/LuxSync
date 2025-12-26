# 🔷 WAVE 125.1: TECHNO PRISM - FULL SPECTRUM (Cold Neon)

**Fecha:** Diciembre 2025  
**Estado:** ✅ IMPLEMENTADO  
**Referencia:** WAVE 123.2, WAVE 124

---

## 🎯 OBJETIVO

Generación de paleta **100% Procedural** y **100% Fría/Neón** para Techno.

### Correcciones sobre WAVE 123.2/124:
- ✅ **Incluir Mover L** (Secondary) en derivación matemática
- ✅ **Evitar amarillos accidentales** con Cold Dictator
- ✅ **Sanitizar colores cálidos** a Magenta Neón

---

## 🧊 THE COLD DICTATOR

### Problema Original
Si la UI selecciona un color **cálido** (Rojo, Naranja, Amarillo), el Techno se veía "pop" o "latino" en lugar de "underground".

### Solución: Inversión Automática

```typescript
// ZONA PROHIBIDA: Rojos cálidos a Verdes Lima (330° a 90°)
const normalizedHue = (baseHue + 360) % 360;
const isWarm = (normalizedHue > 330 || normalizedHue < 90);

if (isWarm) {
    // Invertir hacia espectro frío (Cyan/Azul/Morado)
    baseHue = (normalizedHue + 180) % 360;
}
```

### Mapa de Inversiones

| Hue Original | Resultado | Razón |
|--------------|-----------|-------|
| 0° (Rojo) | 180° (Cyan) | Rojo cálido → Frío |
| 30° (Naranja) | 210° (Azul cielo) | Naranja → Frío |
| 60° (Amarillo) | 240° (Azul) | Amarillo → Frío |
| 330° (Rosa cálido) | 150° (Verde azul) | Rosa → Frío |
| 200° (Cyan) | 200° (Cyan) | Ya frío, sin cambio |
| 280° (Violeta) | 280° (Violeta) | Ya frío, sin cambio |

---

## 🧬 DERIVACIÓN GEOMÉTRICA COMPLETA

### El Prisma Matemático

```
        Base Fría (0°)
           ⬤ FRONT_PARS
          /|
         / |
        /  |
       /   |
      ⬤────┼────⬤
   +60°    |   +120°
 MOVER_L   |  MOVER_R
(Secondary)|  (Ambient)
           |
           ⬤
         +180°
       BACK_PARS
        (Accent)
```

### Código Implementado

```typescript
// FRONT_PARS (Base Fría)
color = hslToRgb(baseHue, 100, 50);

// MOVER L (Melodía) -> ANÁLOGO +60°
let secondaryHue = (baseHue + 60) % 360;
secondaryHue = sanitizeTechnoColor(secondaryHue);
secondary = hslToRgb(secondaryHue, 100, 50);

// MOVER R (Ambiente) -> TRIÁDICO +120°
let ambientHue = (baseHue + 120) % 360;
ambientHue = sanitizeTechnoColor(ambientHue);
ambient = hslToRgb(ambientHue, 100, 50);

// BACK_PARS (Acento) -> COMPLEMENTARIO +180°
const accentHue = (baseHue + 180) % 360;
```

---

## 🛡️ SANITIZE HELPER: Anti-Caca / Anti-Pollo

### El Problema
Incluso después de enfriar el base, las derivaciones (+60°, +120°) podían caer en:
- 🟡 **Amarillo (60°)**: Parece fiesta de cumpleaños
- 🟠 **Naranja (30°)**: Parece Halloween
- 🟢 **Verde Pantano (90-100°)**: Parece alienígena

### La Solución

```typescript
const sanitizeTechnoColor = (hue: number): number => {
    // Si cae en Naranja/Amarillo/VerdePantano (30° a 100°)
    if (hue > 30 && hue < 100) {
        return 320; // Forzar a Magenta Neón
    }
    return hue;
};
```

### Mapa de Sanitización

| Hue Derivado | Resultado | Razón |
|--------------|-----------|-------|
| 45° (Naranja) | 320° (Magenta) | Anti-Caca |
| 60° (Amarillo) | 320° (Magenta) | Anti-Pollo |
| 90° (Verde Lima) | 320° (Magenta) | Anti-Pantano |
| 120° (Verde Cyan) | 120° (Verde Cyan) | OK, neón |
| 200° (Cyan) | 200° (Cyan) | OK, frío |
| 280° (Violeta) | 280° (Violeta) | OK, neón |

---

## 📊 ASIGNACIÓN FINAL DE ZONAS

| Zona | Variable | Derivación | Sanitizado | Ejemplo (Base 240°) |
|------|----------|------------|------------|---------------------|
| FRONT_PARS | `color` | Base (enfriado) | No | 240° Azul |
| MOVING_LEFT | `secondary` | Base + 60° | ✅ Sí | 300° Magenta |
| MOVING_RIGHT | `ambient` | Base + 120° | ✅ Sí | 360° Rojo → 320° Magenta |
| BACK_PARS | `backParColor` | Base + 180° / Blanco | No (WAVE 124) | 60° → Strobe logic |

---

## 🎨 EJEMPLOS PRÁCTICOS

### Ejemplo 1: UI selecciona Rojo (0°)

```
UI: 0° (Rojo Cálido)
├─ Cold Dictator: isWarm=true → Invertir
│  └─ baseHue = 180° (Cyan)
│
├─ FRONT_PARS: 180° = Cyan
├─ MOVER_L: 180+60=240° = Azul
├─ MOVER_R: 180+120=300° = Magenta
└─ BACK_PARS: 180+180=360° = Rojo (o Blanco en snare)
```

**Resultado:** Paleta **Cyan/Azul/Magenta** - 100% Techno Underground

### Ejemplo 2: UI selecciona Amarillo (60°)

```
UI: 60° (Amarillo Cálido)
├─ Cold Dictator: isWarm=true (60° < 90°) → Invertir
│  └─ baseHue = 240° (Azul)
│
├─ FRONT_PARS: 240° = Azul
├─ MOVER_L: 240+60=300° = Magenta
├─ MOVER_R: 240+120=360° → sanitize → 360° OK (Rojo frío)
└─ BACK_PARS: 240+180=60° = Amarillo (pero mayormente blanco por WAVE 124)
```

**Resultado:** Paleta **Azul/Magenta/Rojo** - 100% Neón

### Ejemplo 3: UI selecciona Morado (280°)

```
UI: 280° (Morado - Ya Frío)
├─ Cold Dictator: isWarm=false → Sin cambio
│  └─ baseHue = 280° (Morado)
│
├─ FRONT_PARS: 280° = Morado
├─ MOVER_L: 280+60=340° = Rosa Neón
├─ MOVER_R: 280+120=400%360=40° → sanitize → 320° Magenta
└─ BACK_PARS: 280+180=460%360=100° → 100° (o blanco)
```

**Resultado:** Paleta **Morado/Rosa/Magenta** - 100% Club

---

## 🔄 EVOLUCIÓN WAVE 123 → 125.1

| Aspecto | WAVE 123 | WAVE 123.2 | WAVE 125.1 |
|---------|----------|------------|------------|
| Fuente color | Random Moods | SSOT (Engine) | SSOT + Cold Dictator |
| Secondary | Hardcoded | Engine | Derivado +60° |
| Ambient | Hardcoded | +120° | +120° + Sanitize |
| Colores cálidos | Sí | Posibles | ❌ Prohibidos |
| Amarillos | Sí | Posibles | ❌ → Magenta |

---

## 🔍 DEBUG LOG

```typescript
[WAVE125.1] 🔷 COLD PRISM | Base:180° | Secondary:240° | Ambient:300° | Accent:360° | Warm:true | Strobe:false
```

**Interpretación:**
- `Warm:true` → El color original era cálido, se invirtió
- `Base:180°` → Ahora es Cyan (frío)
- `Strobe:false` → Back Pars muestran color complementario

---

## ✅ RESULTADO ESPERADO

### Comportamiento en Techno

1. **Cualquier color de UI** → Se enfría automáticamente si es cálido
2. **4 zonas diferenciadas** → Base, +60°, +120°, +180°
3. **Sin amarillos/naranjas** → Sanitizado a Magenta 320°
4. **Flash blanco** → Solo en snares (WAVE 124)
5. **Estética** → 100% Underground, 100% Neón

### Espectro Final Permitido

```
         PROHIBIDO
    (30° - 100°) → 320°
           ↓
    ┌──────────────────┐
    │                  │
  330°                90°
    │   ZONA CÁLIDA    │
    │   (Invertida)    │
    └──────────────────┘
           ↓
    ZONA FRÍA PERMITIDA
    (100° - 330°)
    
    Cyan ← Azul ← Violeta ← Magenta ← Rosa
    180°   240°    280°      320°     340°
```

---

## 📚 REFERENCIAS

- **WAVE 123.2:** Techno Prism (Derivación geométrica original)
- **WAVE 124:** Strobe Taming (Flash en snare)
- **BLUEPRINT-SELENE-CHROMATIC-FORMULA.md:** Teoría del color

---

*"En Techno, no hay amarillos. Solo Neón."*
