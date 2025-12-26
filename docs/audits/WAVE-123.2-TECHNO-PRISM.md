# 🔷 WAVE 123.2: TECHNO PRISM ENGINE

**Fecha:** Diciembre 2025  
**Estado:** ✅ IMPLEMENTADO  
**Referencia:** BLUEPRINT-SELENE-CHROMATIC-FORMULA.md

---

## 🚫 ERROR CRÍTICO WAVE 123 (DESHECHO)

### El Problema
WAVE 123 implementó un generador **RANDOM** que ignoraba:
- ❌ El SeleneColorEngine (SSOT)
- ❌ La Key musical detectada
- ❌ El sistema matemático basado en Fibonacci

```typescript
// ❌ ANTI-PATRÓN (Eliminado)
function getTechnoPalette(frameCounter) {
  const moodSelector = Math.floor(frameCounter / 1200) % 3;
  // Colores HARDCODEADOS ignorando la Key musical
  if (moodSelector === 0) { p = 240; s = 300; ... } // CYBERPUNK
  else if (moodSelector === 1) { p = 120; s = 60; ... } // ACID
  else { p = 0; s = 20; ... } // INDUSTRIAL
}
```

---

## ✅ WAVE 123.2: TECHNO PRISM (ENGINE COMPLIANCE)

### Filosofía
> "La UI elige el color base (Key Musical), el Engine deriva los demás matemáticamente."

### Derivación Geométrica

```
PRIMARY (FRONT_PARS)     = state.colors.primary     (SSOT - Key Musical)
SECONDARY (MOVING_LEFT)  = state.colors.secondary   (del Engine)
AMBIENT (MOVING_RIGHT)   = Primary + 120°           (Triádico)
ACCENT (BACK_PARS)       = Primary + 180° | BLANCO  (Complementario/Industrial)
```

### Código Implementado

```typescript
// 🔷 WAVE 123.2: TECHNO PRISM ENGINE
if (preset.name.includes('Techno')) {
    
    // A. VERDAD MUSICAL (Source Of Truth)
    const baseHue = primaryHsl.h;  // Del SeleneColorEngine
    
    // B. EL PRISMA (Derivación Geométrica)
    
    // AMBIENT (Mover R): Triádico +120°
    const ambientHue = (baseHue + 120) % 360;
    ambient = hslToRgb(ambientHue, 100, 50);
    
    // ACCENT (Back Pars): Complementario +180°
    const accentHue = (baseHue + 180) % 360;
    
    // C. INDUSTRIAL FLASH (High Energy Override)
    const isHighEnergy = (agcData.normalizedBass > 0.85);
    
    if (isHighEnergy) {
        // Drop detectado → Blanco puro estroboscópico
        backParColor = { r: 255, g: 255, b: 255 };
    } else {
        // Complementario normal
        backParColor = hslToRgb(accentHue, 100, 60);
    }
}
```

---

## 🎯 ASIGNACIÓN DE ZONAS

| Zona | Variable | Derivación | Efecto Visual |
|------|----------|------------|---------------|
| FRONT_PARS | `color` | Primary (SSOT) | Color base de la canción |
| MOVING_LEFT | `secondary` | Secondary (Engine) | Consistente con Pars |
| MOVING_RIGHT | `ambient` | Primary + 120° | **Diferenciado** de Left |
| BACK_PARS | `backParColor` | Primary + 180° / Blanco | Contraste máximo |

---

## 🏭 INDUSTRIAL FLASH

Cuando `normalizedBass > 0.85`:
- Back Pars → **BLANCO PURO** (r:255, g:255, b:255)
- Efecto estroboscópico en drops
- Referencia: Blueprint "Energy modifies Saturation/Brightness"

---

## 📐 TEORÍA DEL COLOR APLICADA

### Triádico (+120°)
- 3 colores equidistantes en el círculo cromático
- Máxima diferencia manteniendo armonía
- Perfecto para diferenciar MOVER_LEFT de MOVER_RIGHT

### Complementario (+180°)
- Colores opuestos en el círculo
- Máximo contraste visual
- Ideal para Back Pars (acento de fondo)

```
        Primary (0°)
           ⬤
          /|\
         / | \
        /  |  \
       /   |   \
      /    |    \
     ⬤─────┼─────⬤
  Ambient  |  (implícito)
  (+120°)  |
           |
           ⬤
        Accent
        (+180°)
```

---

## 🔄 DIFERENCIAS VS WAVE 123

| Aspecto | WAVE 123 (Eliminado) | WAVE 123.2 (Actual) |
|---------|---------------------|---------------------|
| Fuente de color | Generador random | SeleneColorEngine (SSOT) |
| Respeta Key | ❌ No | ✅ Sí |
| Método | Moods hardcodeados | Derivación geométrica |
| Matemáticas | Sin fundamento | Triádico/Complementario |
| Industrial Flash | Mood rotativo | Basado en energía real |

---

## ✅ VERIFICACIÓN

```
[WAVE123.2] 🔷 TECHNO PRISM | Base:240° | Ambient:360° | Accent:60° | HighEnergy:false
[WAVE123.2] 🔷 TECHNO PRISM | Base:120° | Ambient:240° | Accent:300° | HighEnergy:true
```

---

## 📚 REFERENCIAS

- `BLUEPRINT-SELENE-CHROMATIC-FORMULA.md` - Fórmula Cromática Procedural
- Teoría del Color: Círculo de Quintas Cromático
- SSOT: Single Source of Truth (Primary del Engine)

---

*"No inventamos colores. Derivamos matemáticamente desde la Key musical."*
