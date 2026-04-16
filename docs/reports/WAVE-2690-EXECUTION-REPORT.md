# 🌑 WAVE 2690 — DARK-SPIN GLOBAL Y PURGA GEOMÉTRICA

## EXECUTION REPORT

**Fecha**: 2025-07-15  
**Ejecutor**: PunkOpus  
**Status**: ✅ COMPLETADO  
**TypeScript**: ✅ 0 errores de compilación  

---

## MISIÓN 1: DARK-SPIN GLOBAL (La Ley Física)

### Problema
Los fixtures con rueda mecánica de color (Beam 2R, EL-1140 con perfil wheel) exponen el cristal intermedio durante la rotación de la rueda. El público ve un flash de color no deseado durante los ~500ms de tránsito.

### Solución Implementada

**Nuevo componente**: `DarkSpinFilter.ts` en `hal/translation/`

El filtro es un componente stateful por fixture que:
1. Detecta cambios en el valor DMX del canal `colorWheel`
2. Cuando detecta un cambio, fuerza `dimmer = 0` (blackout silencioso)
3. Mantiene el blackout durante `minChangeTimeMs × 1.1` (margen de seguridad 10%)
4. Libera el dimmer cuando el tránsito termina

**Punto de integración**: `HardwareAbstraction.translateColorToWheel()` — después del `HardwareSafetyLayer.filter()` y antes del `FixtureMapper`.

### Archivos Creados
| Archivo | Líneas | Propósito |
|---------|--------|-----------|
| `hal/translation/DarkSpinFilter.ts` | ~175 | Filtro stateful de blackout durante tránsito mecánico |

### Archivos Modificados
| Archivo | Cambio |
|---------|--------|
| `hal/HardwareAbstraction.ts` | Import + singleton + integración en `translateColorToWheel()` |
| `hal/translation/index.ts` | Export de `DarkSpinFilter`, `DarkSpinResult`, `getDarkSpinFilter` |
| `hal/translation/FixtureProfiles.ts` | `BEAM_2R_PROFILE.safety.blackoutOnColorChange: false → true` |

### Decisión Arquitectónica
DarkSpinFilter es **separado** del SafetyLayer porque tienen responsabilidades distintas:
- **SafetyLayer**: Decide SI un cambio es permitido (debounce, latch, chaos)
- **DarkSpinFilter**: Asume que el cambio ES permitido y enmascara el tránsito

---

## MISIÓN 2: LA PURGA GEOMÉTRICA (Effect Catalog)

### Problema
Selene (Layer 3) estaba enviando instrucciones de pan/tilt/movement en sus efectos, invadiendo el dominio del VibeMovementManager (Layer 0). Los efectos de luz deben pintar fotones, no conducir posiciones.

### Alcance
Se identificaron y purgaron **16 efectos** en total (8 detectados inicialmente + 8 descubiertos en segunda auditoría).

### Efectos Purgados

#### Fiesta Latina (3)
| Efecto | Violación | Purga |
|--------|-----------|-------|
| **ClaveRhythm** | pan/tilt absoluto con snap 80ms, 5 patrones de cadera | Config props, state vars, `updateMovement()`, movement en `getOutput()` |
| **CorazonLatino** | pan offset en cada DUM, tilt -0.2 | `movement` block en moverOverride |
| **OroSolido** | pan/tilt absolutos normalizados (0-1), `isAbsolute: true` | `movement` blocks en movers-left/movers-right |

#### Pop/Rock (4)
| Efecto | Violación | Purga |
|--------|-----------|-------|
| **AmpHeat** | drift imperceptible pan/tilt, `driftAmplitude: 0.05` | Config prop, state var, drift update, movement block |
| **ThunderStruck** | `isAbsolute: true`, pan 0, tilt fijo al público | `movement` block en moverOverride |
| **LiquidSolo** | sweep horizontal smooth con `currentPan` | `movement` block en moverOverride |
| **FeedbackStorm** | pan/tilt caóticos asimétricos izq/der | `movement` blocks en ambos movers |
| **ArenaSweep** | barrido V-shape pan opuesto izq/der | `movement` blocks en ambos movers |

#### Techno (3)
| Efecto | Violación | Purga |
|--------|-----------|-------|
| **FiberOptics** | pan offset rotando 15°/s, tilt fijo 0.3 | Config prop, state var, pan update, movement en return |
| **SkySaw** | scissorMode, ceiling/floor tilt state machine | Category `movement→color`, config props, state vars, tilt machine, movement blocks |
| **DeepBreath** | tilt -30° a +30° siguiendo respiración | pan/tilt calculation, movement block |

#### Chill/Lounge (5)
| Efecto | Violación | Purga |
|--------|-----------|-------|
| **AbyssalJellyfish** | moverPan/Tilt siguiendo medusas | Cálculos pan/tilt + movement blocks movers |
| **WhaleSong** | moverPan siguiendo cabeza ballena, tilt ondulante | Cálculos pan/tilt + movement blocks movers |
| **SolarCaustics** | rayPanL/R/Tilt para rayos de sol | Cálculos pan/tilt + movement blocks movers |
| **SchoolOfFish** | basePan + tiltWobble para cardumen | Cálculos pan/tilt + movement blocks movers |
| **DeepCurrentPulse** | moverPan ±40°, tilt ondulante | Cálculos pan/tilt + movement blocks movers |

### Efectos NO Tocados (verificado)
- **GhostChase.ts** — Ya tiene `// CERO movimiento` explícito
- **SurgicalStrike.ts** — Ya tiene `// CERO movimiento` explícito  
- **VoidMist.ts** — Ya tiene `// CERO movimiento` explícito

### Nota sobre SkySaw
SkySaw era `category: 'movement'` — un efecto 100% de movimiento. La purga lo convirtió en un efecto de color/dimmer puro (`category: 'color'`). Su state machine de cuts (rising/ceiling_hold/falling/floor_hold) se preservó — ahora controla flashes de dimmer en lugar de arcos de tilt.

### Verificación Final
```
grep "movement:" electron-app/src/core/effects/library/**/*.ts
→ 0 matches
```

**CERO instrucciones de movimiento en todo el catálogo de efectos de Selene.**

---

## ARQUITECTURA POST-WAVE 2690

```
                    ┌──────────────────────────────┐
                    │   VibeMovementManager (L0)   │
                    │   ÚNICA FUENTE de pan/tilt    │
                    └──────────┬───────────────────┘
                               │
                    ┌──────────┴───────────────────┐
                    │    Selene Effect Engine (L3)  │
                    │    SOLO: dimmer, color,       │
                    │    white, amber, blendMode    │
                    │    ❌ NO: pan, tilt, movement │
                    └──────────┬───────────────────┘
                               │
                    ┌──────────┴───────────────────┐
                    │     HAL Translation Layer     │
                    │  ColorTranslator → Quantizer  │
                    │  → SafetyLayer → DarkSpin 🌑  │
                    │  → FixtureMapper → DMX        │
                    └──────────────────────────────┘
```

**Selene pinta fotones. Layer 0 conduce posiciones. HAL protege el tránsito.**
