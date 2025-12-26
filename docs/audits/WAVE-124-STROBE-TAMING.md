# ⚪ WAVE 124: STROBE TAMING - Flash Solo en Snare Explosivo

**Fecha:** Diciembre 2025  
**Estado:** ✅ IMPLEMENTADO  
**Referencia:** WAVE 123.2 (Techno Prism)

---

## 🚨 PROBLEMA CRÍTICO WAVE 123.2

### El Síntoma
Back Pars **BLANCOS EL 100% DEL TIEMPO** en Techno:
- ❌ Parecían luces de hospital, no un club
- ❌ Flash estroboscópico constante (epilepsia warning)
- ❌ No se veía el color complementario derivado matemáticamente

### La Causa Raíz
```typescript
// ❌ WAVE 123.2 (ANTES): Diagnóstico erróneo
const isHighEnergy = (agcData?.normalizedBass ?? 0) > 0.85;

// En Techno, avgNormBass está SIEMPRE entre 0.85-0.95
// → isHighEnergy = TRUE el 100% del tiempo
// → Back Pars = BLANCO constante
```

### ¿Por Qué Pasó Esto?
En **Techno**, el bajo es **CONSTANTE** y **ALTO**:
- `normalizedBass` normalizado por el AGC ronda **0.90-0.95** todo el tiempo
- El umbral `> 0.85` era demasiado **BAJO**
- No diferenciaba entre "bass constante" y "drop explosivo"

---

## ✅ WAVE 124: LA SOLUCIÓN - TREBLE PULSE

### Filosofía
> "El flash blanco debe ser un EVENTO, no un ESTADO."

### Cambio Implementado

```typescript
// ✅ WAVE 124 (AHORA): Usar Treble Pulse (Snare/Clap)
const isSnareExplosion = treblePulse > 0.6;

if (isSnareExplosion) {
    // ⚪ WHITE FLASH: Solo milisegundos en golpe fuerte
    backParColor = { r: 255, g: 255, b: 255 };
} else {
    // 🎨 COLOR DE ACENTO: Complementario el 95% del tiempo
    backParColor = hslToRgb(accentHue, 100, 60);
}
```

---

## 🎛️ TREBLE PULSE: LA SEÑAL CORRECTA

### ¿Qué es treblePulse?
```typescript
// WAVE 117.1: Virtual Crossover
const trebleFloor = 0.15; // Floor fijo para agudos
let treblePulse = rawTreble - trebleFloor;
if (treblePulse < 0) treblePulse = 0;
```

### Rangos Típicos en Techno

| Instrumento | rawTreble | treblePulse | Resultado |
|-------------|-----------|-------------|-----------|
| Silencio | 0.10 | 0.00 | Sin flash |
| Hi-Hat | 0.15-0.20 | 0.00-0.05 | Sin flash |
| Snare suave | 0.25 | 0.10 | Sin flash |
| **Snare fuerte** | **0.75** | **0.60** | ⚪ **FLASH** |
| **Clap/Rim** | **0.85** | **0.70** | ⚪ **FLASH** |

### ¿Por Qué > 0.6?
- Snare típico: `treblePulse = 0.20-0.40` → **Sin flash**
- Snare explosivo: `treblePulse = 0.60-0.80` → **Flash activado**
- Hi-Hat/Ride: `treblePulse = 0.00-0.10` → **Sin flash**

**Resultado:** El flash ocurre solo 5-10% del tiempo, en golpes **REALMENTE** fuertes.

---

## 📊 COMPARATIVA ANTES/DESPUÉS

### WAVE 123.2 (Antes)
| Métrica | Valor | Problema |
|---------|-------|----------|
| Señal usada | `normalizedBass` | Siempre alto en Techno |
| Umbral | `> 0.85` | Demasiado bajo |
| % Tiempo blanco | **~95%** | Luz de hospital |
| % Tiempo color | **~5%** | Casi nunca se ve |

### WAVE 124 (Ahora)
| Métrica | Valor | Beneficio |
|---------|-------|-----------|
| Señal usada | `treblePulse` | Solo snares/claps |
| Umbral | `> 0.6` | Muy exigente |
| % Tiempo blanco | **~5%** | Flash real |
| % Tiempo color | **~95%** | Color complementario visible |

---

## 🎨 IMPACTO VISUAL

### Antes (WAVE 123.2)
```
[Bass] ████████████████████████████████  (Constante, alto)
[Back Pars] ⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪  (Blanco todo el tiempo)
```

### Ahora (WAVE 124)
```
[Treble] ▁▁▃▁▁▁▁█▁▁▃▁▁▁▁█▁▁▃▁▁▁▁█  (Pulsos de snare)
[Back Pars] 🟠🟠🟠🟠🟠⚪🟠🟠🟠🟠🟠⚪🟠🟠  (Color + flash puntual)
```

**Lectura:**
- `█` = Snare explosivo (treblePulse > 0.6)
- `⚪` = Flash blanco (solo en snare)
- `🟠` = Color complementario (el resto del tiempo)

---

## 🔧 INTEGRACIÓN CON WAVE 123.2

### Arquitectura Completa

```typescript
// 1. WAVE 123.2: Derivación geométrica de colores
const baseHue = primaryHsl.h;              // SSOT (Key musical)
const ambientHue = (baseHue + 120) % 360;  // Triádico
const accentHue = (baseHue + 180) % 360;   // Complementario

// 2. WAVE 124: Strobe Taming (nuevo)
const isSnareExplosion = treblePulse > 0.6;

if (isSnareExplosion) {
    backParColor = { r: 255, g: 255, b: 255 };  // Flash
} else {
    backParColor = hslToRgb(accentHue, 100, 60); // Color
}
```

---

## 🎯 ASIGNACIÓN FINAL DE ZONAS

| Zona | Variable | Derivación | Comportamiento |
|------|----------|------------|----------------|
| FRONT_PARS | `color` | Primary (SSOT) | Color base estable |
| MOVING_LEFT | `secondary` | Secondary (Engine) | Consistente con pars |
| MOVING_RIGHT | `ambient` | Primary + 120° | Triádico diferenciado |
| BACK_PARS | `backParColor` | **Primary + 180° / Blanco** | **95% color, 5% flash** |

---

## 🔍 DEBUG LOG

```typescript
[WAVE124] 🔷 TECHNO PRISM | Base:240° | Ambient:360° | Accent:60° | TreblePulse:0.15 | Strobe:false
[WAVE124] 🔷 TECHNO PRISM | Base:240° | Ambient:360° | Accent:60° | TreblePulse:0.72 | Strobe:true
```

**Interpretación:**
- `TreblePulse:0.15` → Bajo umbral → `Strobe:false` → Color complementario
- `TreblePulse:0.72` → Sobre umbral → `Strobe:true` → Flash blanco

---

## ✅ RESULTADO ESPERADO

### Comportamiento en Techno

1. **El 95% del tiempo:**
   - Back Pars muestran el **color complementario** (Ej: Azul → Naranja)
   - Estable, visualmente hermoso, coherente con el Techno Prism

2. **El 5% del tiempo (snares fuertes):**
   - Back Pars hacen **flash BLANCO** milisegundos
   - Efecto estroboscópico **real**, no constante
   - Sincronizado con snare/clap, no con el bajo

3. **Fin del parpadeo epiléptico:**
   - Ya no parece una ambulancia
   - Ya no es amarillo-blanco-amarillo-blanco constante
   - Es un **club**, no un **hospital**

---

## 📚 REFERENCIAS TÉCNICAS

- **WAVE 117.1:** Virtual Crossover (treblePulse calculation)
- **WAVE 123.2:** Techno Prism (derivación geométrica)
- **BLUEPRINT-SELENE-CHROMATIC-FORMULA.md:** Teoría del color procedural

---

## 🎓 LECCIÓN APRENDIDA

> **"En Techno, el bajo es constante. El snare es el evento."**

Para detectar **drops** y **momentos de impacto**, no uses:
- ❌ `avgNormBass` (siempre alto en Techno)
- ❌ `normalizedEnergy` (promediado, lento)

Usa:
- ✅ `treblePulse` (picos instantáneos de snare/clap)
- ✅ Umbrales exigentes (`> 0.6` para flash real)

---

*"El flash no es un estado. Es un evento."*
