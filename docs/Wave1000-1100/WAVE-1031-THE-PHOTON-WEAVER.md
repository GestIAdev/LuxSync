# 🟢🎨 WAVE 1031: THE PHOTON WEAVER

## Spectral Band Physics - La Arquitectura Completa del Sonido Visual

**Commit:** Pendiente  
**Fecha:** 2026-01-28  
**Autor:** PunkOpus & Radwulf  
**Status:** ✅ IMPLEMENTADO

---

## 📜 FILOSOFÍA

> "Cada banda de frecuencia tiene su dominio visual. Los láseres cortan el aire donde los humanos apenas oyen. Los washers respiran donde el cuerpo SIENTE."

Con esta WAVE, LuxSync cubre **TODO EL ESPECTRO AUDIOVISUAL**:

| Frecuencia | Fixture | Rol |
|------------|---------|-----|
| **Sub-Graves** (20-60Hz) | Washers/Barras LED | Sentimiento/Atmósfera |
| **Medios** (250-4000Hz) | Movers/PARs | Ritmo/Baile |
| **Ultra-Agudos** (16-22kHz) | Láseres/Scanners | Detalle/Tecnología |

---

## 🟢 LASER PHYSICS - "La Cirugía de Luz"

### Filosofía
Los láseres **no son luces**. Son **PROYECTILES**. No tienen inercia, tienen velocidad de escaneo.
Responden a las frecuencias que los humanos **CASI NO OYEN**.

### Source Mapping
- **Input Principal:** `spectral.bands.ultraAir` (16-22kHz)
  - Los láseres son lo ÚNICO visualmente tan rápido como esas frecuencias
- **Input Secundario:** `spectral.clarity`
  - Clarity > 0.9: Haz fino y preciso
  - Clarity < 0.5: Haz caótico o ensanchado

### Comportamientos

#### LIQUID_SKY (Textura: Clean/Warm)
```
                    ~~~~~~~~~~~~~~~~~~~
                   ~~~~~~~~~~~~~~~~~~~~
El público →      ~~~~~~~~~~~~~~~~~~~~~  ← Línea horizontal ondulante
                   ~~~~~~~~~~~~~~~~~~~~
                    ~~~~~~~~~~~~~~~~~~~
```
- **Movimiento:** Ondulación lenta (Sine Wave) modulada por LowMid
- **Vibe:** Trance, Progressive, Momentos épicos
- **Trigger:** Sonido limpio o cálido

#### SPARKLE_RAIN (Textura: Harsh/Noisy)
```
                    *   *       *
                 *       *   *     *
El público →      *   *       *   *    ← Puntos a alta velocidad
                    *     *       *
                 *       *   *
```
- **Movimiento:** Puntos disparados a altísima velocidad
- **Vibe:** Techno Industrial, Glitch, Noise
- **Trigger:** Picos en UltraAir (Hi-Hats, Shakers digitales)

### 👁️🚫 PROTOCOLO RETINA GUARD

**REGLA INVIOLABLE: AudienceClipping**

```typescript
// horizonLimit: -1 (suelo) a +1 (techo)
// DEFAULT: 0.3 (30% por encima de los ojos)

if (verticalPosition < eyeLineNormalized - 0.1) {
  // KILL absoluto - el láser NO puede apuntar al público
  safeIntensity = 0
  safetyTriggered = true
}
```

**NUNCA** permitir que el Pan/Tilt del láser cruce la línea de los ojos del público, sin importar lo que diga el efecto.

---

## 🎨 WASHER PHYSICS - "El Lienzo de Fondo"

### Filosofía
Los Washers (y barras LED) **no marcan el ritmo**, marcan la **ATMÓSFERA**.
Viven en el **SUBSUELO** frecuencial donde la música se **SIENTE**, no se oye.

### Source Mapping
- **Input Principal:** `spectral.bands.subBass` (20-60Hz)
  - Presión de aire, el "empujón" físico de los graves
- **Input Secundario:** `spectral.texture`
  - Determina si la sala "respira" o "explota"

### Comportamientos

#### BREATHING_WALL (Textura: Warm/Clean)
```
        ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
        ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  ← Inhala (2 seg)
        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
        ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  ← Exhala (2 seg)
        ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```
- **Intensidad:** Vinculada suavemente al volumen general
- **Color:** Transiciones lentas (2 segundos de interpolación)
- **Efecto:** La sala "respira" con la música

#### REACTIVE_STROBE (Textura: Harsh)
```
        ████████████████████████████████
        ████████████████████████████████  ← IMPACTO TOTAL
        ████████████████████████████████
        ████████████████████████████████
        ████████████████████████████████
```
- **Trigger:** Golpes fuertes de Bass
- **Efecto:** Impacto total de color (toda la sala explota)
- **Decay:** Rápido (100ms)

### Diferencia con PARs
| Aspecto | PARs | Washers |
|---------|------|---------|
| Fuente | Bass/Mid (200-2000Hz) | SubBass (20-60Hz) |
| Rol | Ritmo puntual (kick, snare) | Atmósfera continua |
| Velocidad | Instantánea | Gradual (2 seg) |
| Floor | 0% (pueden apagarse) | 15% (siempre encendidos) |

---

## 🔌 EL ENRUTADOR FÍSICO (SeleneLux)

### Arquitectura de Routing

```typescript
// La física espectral es UNIVERSAL - todos los vibes la reciben

// 1. Procesar motores de género (Techno, Rock, Latino, Chill)
//    → front, back, mover, moverL, moverR

// 2. Procesar motores espectrales (SIEMPRE, independiente del género)
//    → laser (ultraAir 16-22kHz)
//    → washer (subBass 20-60Hz)

const zoneIntensities = {
  front,      // Bass → Front PARs
  back,       // Mid → Back PARs  
  mover,      // Treble → Movers (legacy)
  moverL,     // Mid-dominant → Mover izquierdo
  moverR,     // Treble-dominant → Mover derecho
  laser,      // 🟢 UltraAir → Láseres (NEW!)
  washer,     // 🎨 SubBass → Washers (NEW!)
}
```

### Flujo de Datos

```
God Ear (FFT)
    │
    ├── bass, mid, treble → Motores de Género
    │                         ↓
    │                    front, back, mover
    │
    ├── ultraAir (16-22kHz) → LaserPhysics
    │                              ↓
    │                         laser intensity
    │
    └── subBass (20-60Hz) → WasherPhysics
                                 ↓
                            washer intensity
                                 │
                                 ▼
                         SeleneLuxOutput
                              │
                              ▼
                      HAL/DMX Drivers
```

---

## 📁 ARCHIVOS MODIFICADOS/CREADOS

### Nuevos Archivos
| Archivo | Líneas | Descripción |
|---------|--------|-------------|
| `LaserPhysics.ts` | ~350 | Motor de física para láseres |
| `WasherPhysics.ts` | ~300 | Motor de física para washers |

### Archivos Modificados
| Archivo | Cambios | Descripción |
|---------|---------|-------------|
| `physics/index.ts` | +30 | Exports de LaserPhysics y WasherPhysics |
| `SeleneLux.ts` | +100 | Integración de nuevos motores |

---

## 🎯 OUTPUT EXTENDIDO

### SeleneLuxOutput (WAVE 1031)

```typescript
interface SeleneLuxOutput {
  palette: { primary, secondary, ambient, accent }
  
  zoneIntensities: {
    front: number      // Bass → Front PARs
    back: number       // Mid → Back PARs
    mover: number      // Treble → Movers (legacy)
    moverL?: number    // L channel
    moverR?: number    // R channel
    laser?: number     // 🟢 NEW: UltraAir → Lasers
    washer?: number    // 🎨 NEW: SubBass → Washers
  }
  
  // 🟢🎨 WAVE 1031: Extended physics metadata
  laserPhysics?: {
    mode: 'liquid_sky' | 'sparkle_rain' | 'standby'
    beamWidth: number      // 0-1 (fino a ensanchado)
    scanSpeed: number      // 0-1 (lento a rápido)
    safetyTriggered: boolean  // 👁️🚫 RETINA GUARD
  }
  
  washerPhysics?: {
    mode: 'breathing_wall' | 'reactive_strobe' | 'ambient_glow'
    colorTransitionSpeed: number  // segundos
    impactActive: boolean         // ¿hay golpe de bass?
    breathingFactor: number       // -1 a +1
  }
}
```

---

## 🎵 EJEMPLOS DE COMPORTAMIENTO

### Techno Industrial (Harsh, High Energy)
```
UltraAir: 0.7 (hi-hats metálicos)
SubBass: 0.8 (kick destructor)
Texture: harsh
Clarity: 0.6

→ Laser: SPARKLE_RAIN @ 70% (puntos rápidos)
→ Washer: REACTIVE_STROBE @ 80% (flash en cada kick)
```

### Trance Épico (Clean, High Clarity)
```
UltraAir: 0.4 (shimmers)
SubBass: 0.5 (bass profundo)
Texture: clean
Clarity: 0.9

→ Laser: LIQUID_SKY @ 40% (ondulación horizontal)
→ Washer: BREATHING_WALL @ 55% (la sala respira)
```

### Chill/Ambient (Warm, Low Energy)
```
UltraAir: 0.1 (casi nada)
SubBass: 0.3 (pads graves)
Texture: warm
Clarity: 0.8

→ Laser: STANDBY @ 0% (apagado)
→ Washer: BREATHING_WALL @ 35% (respiración suave)
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [x] `LaserPhysics.ts` - Motor completo con RETINA GUARD
- [x] `WasherPhysics.ts` - Motor completo con BREATHING_WALL
- [x] `physics/index.ts` - Exports actualizados
- [x] `SeleneLux.ts` - Integración de nuevos motores
- [x] `SeleneLuxOutput` - Interface extendida con laser/washer
- [x] Documentación WAVE-1031
- [ ] Git commit

---

## 🔮 PRÓXIMOS PASOS

1. **HAL Integration:** Conectar `zoneIntensities.laser` y `zoneIntensities.washer` a los drivers DMX
2. **Fixture Detection:** Auto-detectar fixtures tipo LASER y WASHER
3. **Safety Config UI:** Permitir configurar `horizonLimit` desde la UI
4. **Real Hardware Test:** Probar con láser físico (con MUCHO cuidado 👁️)

---

*"El techno vive en los medios. El láser vive en el aire. El washer vive en el subsuelo. Juntos, cubren todo el espectro de la percepción humana."* 🟢🎨
