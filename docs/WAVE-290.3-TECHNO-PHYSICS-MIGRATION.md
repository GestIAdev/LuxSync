# WAVE 290.3: TECHNO STEREO PHYSICS MIGRATION

## RESUMEN EJECUTIVO

Migración de las físicas específicas de Techno desde `PhysicsEngine.ts` a `TechnoStereoPhysics.ts`, dejando el motor global limpio y preparado para arquitectura escalable.

## PROBLEMA IDENTIFICADO

`PhysicsEngine.ts` contenía lógica específica de Techno que violaba el principio de responsabilidad única:

```typescript
// CÓDIGO TECHNO-ESPECÍFICO EN MOTOR GLOBAL (MAL)
TREBLE_VITAMIN = 2.2  // Solo Techno usa esto
calculateMoverTarget() // ~100 líneas de lógica Techno
MOVER_HYSTERESIS_MARGIN = 0.06  // Tuning específico Techno
```

## SOLUCIÓN ARQUITECTÓNICA

### 1. TechnoStereoPhysics.ts - DOBLE API

Creamos una clase con **dos APIs** para mantener compatibilidad:

```typescript
export class TechnoStereoPhysics {
  // ═══════════════════════════════════════════════════════════════
  // API ESTÁTICA (Legacy) - Para SeleneLux/Colores
  // ═══════════════════════════════════════════════════════════════
  
  public static apply(
    palette: TechnoPalette,
    audio: TechnoAudioMetrics,
    mods?: ElementalModifiers
  ): TechnoLegacyResult
  
  // ═══════════════════════════════════════════════════════════════
  // API DE INSTANCIA (Nueva) - Para Zonas/Intensidades
  // ═══════════════════════════════════════════════════════════════
  
  public applyZones(input: TechnoPhysicsInput): TechnoPhysicsResult
}
```

### 2. PhysicsEngine.ts - LIMPIEZA + ADVERTENCIA

```typescript
/**
 * 🏛️ WAVE 205: PHYSICS ENGINE - GLOBAL PHYSICS ONLY
 * 
 * ⚠️ ADVERTENCIA WAVE 290.3: Este es un motor de FISICAS GLOBALES.
 * NO debe contener logica especifica de ningun vibe (Techno, Latino, etc).
 * 
 * Cada vibe tiene su propio motor de fisicas:
 * - TechnoStereoPhysics.ts → Fisicas especificas de Techno
 * - LatinoStereoPhysics.ts → Fisicas especificas de Latino
 */
```

- `calculateMoverTarget()` marcado como **@deprecated**
- Añadido console.warn para detectar uso legacy

## CONSTANTES MIGRADAS A TECHNO

| Constante | Valor | Descripción |
|-----------|-------|-------------|
| `TREBLE_VITAMIN` | 2.2 | Boost para compensar compresión MP3 |
| `ACTIVATION_THRESHOLD` | 0.15 | Solo picos fuertes activan |
| `VISIBILITY_FLOOR` | 0.18 | 18% mínimo visible |
| `HYSTERESIS_MARGIN` | 0.06 | Anti-epilepsy gap |
| `INTENSITY_SMOOTHING` | 0.4 | 40% previous frame |
| `MIN_STABLE_FRAMES` | 2 | Frames antes de cambio |
| `STROBE_THRESHOLD` | 0.85 | Solo peaks extremos |
| `FRONT_PAR_BASE` | 0.25 | Base baja para contraste |
| `BACK_PAR_GATE` | 0.25 | Gate para backs |

## ARQUITECTURA FINAL

```
                    ┌─────────────────────────────────────┐
                    │         SeleneLux.ts                │
                    │       (Sistema Nervioso)            │
                    └─────────────┬───────────────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
              ▼                   ▼                   ▼
   ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
   │ TechnoStereo     │ │ LatinoStereo     │ │ RockStereo       │
   │ Physics.ts       │ │ Physics.ts       │ │ Physics.ts       │
   │ ⚡ TREBLE/STROBE  │ │ 💃 MID/BASS      │ │ 🎸 SNARE/KICK    │
   └──────────────────┘ └──────────────────┘ └──────────────────┘
              │                   │                   │
              └───────────────────┼───────────────────┘
                                  │
                    ┌─────────────▼───────────────────────┐
                    │         PhysicsEngine.ts            │
                    │    (SOLO Físicas GLOBALES)          │
                    │    - Decay buffers                  │
                    │    - Attack/Decay asimétrico        │
                    │    - Soft knee clipping             │
                    └─────────────────────────────────────┘
```

## ARCHIVOS MODIFICADOS

| Archivo | Cambio |
|---------|--------|
| `TechnoStereoPhysics.ts` | **REESCRITO** - Doble API, lógica de movers migrada |
| `PhysicsEngine.ts` | Header actualizado + deprecated calculateMoverTarget |
| `physics/index.ts` | Export del singleton `technoStereoPhysics` |
| `SeleneLux.ts` | Import singleton, `technoOverrides`, dispatch con `applyZones()` |
| `TitanEngine.ts` | Override de zonas para `physicsApplied === 'techno'` |

## COMPATIBILIDAD

✅ **Mantenida 100%** - El código existente que usa `TechnoStereoPhysics.apply()` sigue funcionando
✅ **Nueva API** disponible vía `technoStereoPhysics.applyZones()` singleton

## USO DE LA NUEVA API

```typescript
import { technoStereoPhysics } from '../../hal/physics';

// Nueva API para zonas
const result = technoStereoPhysics.applyZones({
  bass: 0.5,
  mid: 0.3,
  treble: 0.7,
  bpm: 128,
  melodyThreshold: 0.4,
  isRealSilence: false,
  isAGCTrap: false,
  sectionType: 'drop'
});

// result contiene:
// - frontParIntensity: number
// - backParIntensity: number
// - moverIntensity: number
// - moverActive: boolean
// - strobeActive: boolean
// - strobeIntensity: number
// - physicsApplied: 'techno'
```

## SIGUIENTE PASO

~~Para integrar completamente TechnoStereoPhysics en el flujo de zonas (como Latino):~~

~~1. Añadir `technoOverrides` a SeleneLux~~
~~2. Usar `technoStereoPhysics.applyZones()` en el dispatch de Techno~~
~~3. Pasar overrides a TitanEngine~~

✅ **TODO COMPLETADO** - Techno ahora usa su propio motor de físicas de zonas.

---

**Estado:** ✅ COMPLETADO
**Build:** Todos los archivos sin errores de TypeScript
**Compatibilidad:** 100% backward compatible
**Integración:** Completa en SeleneLux y TitanEngine
