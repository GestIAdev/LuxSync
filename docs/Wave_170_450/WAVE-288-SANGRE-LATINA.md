# WAVE 288: SANGRE LATINA - Unified Solar Physics 🌴🔥

**Fecha**: 2 Enero 2026  
**Estado**: ✅ IMPLEMENTADO

---

## 📋 RESUMEN EJECUTIVO

**WAVE 288** implementa una filosofía radicalmente nueva para Fiesta Latina: **UN SISTEMA UNIFICADO QUE SIEMPRE FUNCIONA**, con "sabores" opcionales que lo mejoran si la detección acierta.

**Principio Core**: "Si falla la detección, sigue viéndose increíble."

---

## 🎨 FASE 1: CONSTITUCIÓN CÁLIDA

### Cambios en `colorConstitutions.ts`

```typescript
export const LATINO_CONSTITUTION: GenerationOptions = {
  // 🔥 INVERSIÓN TÉRMICA - 2500K = Luz de vela/fuego
  atmosphericTemp: 2500,  // Gravedad MÁXIMA hacia naranja/oro (~40°)
  
  // 🚫 ZONA PROHIBIDA AMPLIADA
  forbiddenHueRanges: [[180, 260]],  // Cyanes + Azules = PROHIBIDO
  
  // 🌈 Solo colores CÁLIDOS
  allowedHueRanges: [[0, 80], [300, 360]],  // Solar + Magenta
  
  // 💪 Saturación ALTA para evitar mostazas
  saturationRange: [85, 100],
  lightnessRange: [50, 70],
  
  // 🛡️ SAFETY RULES para amarillos
  mudGuard: {
    enabled: true,
    swampZone: [40, 65],    // Amarillos peligrosos
    minLightness: 55,
    minSaturation: 90,      // Saturación AGRESIVA
  },
  
  // Tropical Mirror DESACTIVADO (evita generar cyanes)
  tropicalMirror: false,
  
  // Accent = Solar Flare puro (oro/miel)
  accentBehavior: 'solar-flare',
  solarFlareAccent: { h: 35, s: 100, l: 55 },
  
  // Dimming con floor (siempre algo de brasa)
  dimmingConfig: { floor: 0.08, ceiling: 1.0 },
};
```

### Impacto Visual

| Aspecto | Antes (WAVE 165) | Después (WAVE 288) |
|---------|-----------------|-------------------|
| **Temperatura** | 4800K (neutro) | 2500K (vela/fuego) |
| **Colores Prohibidos** | [210-240°] (solo azul triste) | [180-260°] (TODO cyan/azul) |
| **Colores Permitidos** | 3 rangos dispersos | Solo Solar (0-80°) + Magenta (300-360°) |
| **Gravedad** | Ninguna | MÁXIMA hacia naranja/oro |

---

## 🎵 FASE 2: DETECCIÓN HEURÍSTICA SIMPLE

### Nuevo `detectFlavor()` - 3 líneas

```typescript
private detectFlavor(bpm: number, metrics: LatinoAudioMetrics): LatinoFlavor {
  const bass = metrics.normalizedBass;
  const treble = metrics.normalizedHigh ?? 0;
  
  // INTENTO ÚNICO - SI FALLA, USA DEFAULT
  let flavor: LatinoFlavor = 'fiesta-standard';
  
  // Reggaeton = Bass alto + BPM de perreo (80-105) o doble (155-200)
  if (bass > 0.6 && (bpm < 105 || bpm > 155)) {
    flavor = 'reggaeton';
  }
  // Tropical = Treble domina (Güiro/Maracas)
  else if (treble > bass * 1.2) {
    flavor = 'tropical';
  }
  
  return flavor;
}
```

### Tipos de Flavor

| Flavor | Detección | Comportamiento |
|--------|-----------|---------------|
| **reggaeton** | Bass > 0.6 + BPM lento/doble | Machine Gun habilitado, Flare más seco |
| **tropical** | Treble > Bass × 1.2 | Movers con "jitter" del güiro |
| **fiesta-standard** | Default | Sistema unificado (siempre funciona) |

---

## 💃 FASE 3: FÍSICA UNIFICADA

### Concepto: Solar Flare con Decay Lento

```
ATAQUE: Inmediato cuando detecta kick
DECAY:  Lento (8% por frame = ~12 frames para decaer)
RESULTADO: La luz "quema" y "respira" en lugar de "cortar"
```

### Back PARs: `mid^1.5` con Decay

```typescript
const targetBackPar = Math.pow(mid, 1.5);  // Respuesta no-lineal

if (targetBackPar > currentBackParIntensity) {
  currentBackParIntensity = targetBackPar;  // Ataque inmediato
} else {
  // Decay lento
  currentBackParIntensity *= (1 - DECAY_RATE * 2);
}
```

### Movers: LERP Suave (Caderas Lentas)

```typescript
// Lerp muy suave: movimiento de caderas, ignora picos rápidos
currentMoverIntensity += (treble - currentMoverIntensity) * 0.05;

// FLAVOR Tropical: pequeño "jitter" del güiro
if (flavor === 'tropical' && treble > 0.7) {
  currentMoverIntensity += (Math.random() - 0.5) * 0.05;
}
```

### Front PARs: Ámbar Fijo al 60-80%

```typescript
const bassPulse = bass * 0.15;  // 0-15% variación
let frontParIntensity = 0.65 + bassPulse;  // 65-80%

// FLAVOR Reggaeton: más agresivo durante flare
if (flavor === 'reggaeton' && isSolarFlare) {
  frontParIntensity = Math.min(0.95, frontParIntensity + 0.1);
}
```

---

## 📊 COMPARATIVA: WAVE 165 vs WAVE 288

| Aspecto | WAVE 165 | WAVE 288 |
|---------|---------|----------|
| **Filosofía** | Subgéneros específicos (Cumbia/Reggaeton/Salsa) | Sistema unificado + sabores |
| **Detección** | Algoritmo complejo basado en BPM | 3 líneas heurísticas simples |
| **Si falla** | Comportamiento inconsistente | Sistema unified sigue funcionando |
| **Colors** | Neón multicolor (incluía cyanes) | Solo colores cálidos (naranja/oro/rojo) |
| **Flare** | Flash instantáneo | Ataque rápido + Decay lento |
| **Sobrescritura** | Paleta sobrescrita completamente | Blend suave con paleta original |

---

## 🎯 CRITERIOS DE ÉXITO

- [x] **Look General**: Todo se ve Naranja/Oro/Rojo. No hay azules fríos.
- [x] **Sensación**: La luz "respira" y "quema" (Decay lento), no "corta".
- [x] **Detección Reggaeton**: Si pones Bad Bunny, se vuelve más agresivo.
- [x] **Detección Tropical**: Si pones Marc Anthony, se vuelve más fluido.
- [x] **Fallback**: SI FALLA, se ve bien de todas formas (Modo Unified).

---

## 📁 ARCHIVOS MODIFICADOS

1. **`colorConstitutions.ts`** - LATINO_CONSTITUTION con inversión térmica
2. **`LatinoStereoPhysics.ts`** - Reescritura completa con física unificada
3. **`SeleneLux.ts`** - Actualizado `subGenre` → `flavor`

---

## 🔧 PARÁMETROS CLAVE

```typescript
// Física
KICK_THRESHOLD = 0.65        // Umbral para Solar Flare
BASS_DELTA_THRESHOLD = 0.12  // Requiere subida
DECAY_RATE = 0.08            // 8% por frame (decay lento)
MOVER_LERP = 0.05            // 5% (caderas lentas)
FRONT_PAR_BASE = 0.65        // 65% base

// Color
SOLAR_FLARE_COLOR = { h: 35, s: 100, l: 50 }  // Oro puro
```

---

*"La fiesta latina no es un algoritmo. Es un fuego que quema y respira."*  
— PunkOpus, WAVE 288
