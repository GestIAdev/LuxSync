¡Perfecto que se ve bien! Vamos a por el LiquidEngineBase. Déjame encontrarlo:

Ahora veamos el perfil techno y sus overrides 4.1:

Ahora veamos qué perfiles hay disponibles (latino, etc):

Ahora también veamos el LiquidEnvelope para entender los parámetros:

Ahora tengo todo. Aquí está el resumen completo para el Arquitecto:

## LiquidEngineBase — Envelopes de Movers y Config 4.1/7.1

### Arquitectura del motor

El `LiquidEngineBase` tiene **6 envelopes** (LiquidEnvelope) que procesan las bandas del GodEarFFT:

| Envelope | Canal | Rol |
|----------|-------|-----|
| `envSubBass` | Front L | El Océano — subgraves continuos |
| `envKick` | Front R | El Francotirador — bombo percutivo |
| `envSnare` | Back R | El Látigo — snare/hi-hat transitorio |
| `envHighMid` | Back L | Mid synths / congas / palmas |
| `envTreble` | Mover L | "El Galán" — melodías tonales |
| `envVocal` | Mover R | "La Dama" — voces / trompetas / brillo |

### Parámetros de cada envelope (LiquidEnvelopeConfig)

| Parámetro | Rango | Función |
|-----------|-------|---------|
| `gateOn` | 0-1 | Umbral de activación. Más bajo = más sensible |
| `boost` | >0 | Multiplicador de ganancia post-gate |
| `crushExponent` | >0 | >1 = selectivo (solo picos), <1 = expansivo (infla valores bajos) |
| `decayBase` | 0-1 | Factor de decay por frame en morph=0. Más alto = decay más lento |
| `decayRange` | 0-1 | Modulación de decay por morphFactor |
| `maxIntensity` | 0-1 | Cap de intensidad máxima de salida |
| `squelchBase` | 0-1 | Umbral anti-pad-ghost en morph=0 |
| `squelchSlope` | 0-1 | Cuánto baja el squelch con morphFactor |
| `ghostCap` | 0-1 | Soft knee subliminal glow |
| `gateMargin` | 0-1 | Margen fijo sobre gate adaptativo |
| `attackSlopeMin` | 0-1 | Pendiente mínima de ataque para disparar |
| `riseRate` | 0-1 | Velocidad máx de subida por frame (anti-tembleque) |

### Movers — Cross-filter coefficients (LiquidEngineBase líneas 654-680)

**Mover L (El Galán)** — `envTreble`:
```
input = max(0, highMid × moverLHighMidWeight + treble × moverLTrebleWeight + mid × moverLMidWeight)
gate tonal: si flatness >= moverLTonalThreshold → ruido, cortar
```

**Mover R (La Dama)** — `envVocal`:
```
subtractFactor = bassSubtractBase - morphFactor × bassSubtractRange
cleanMid = max(0, mid - bass × subtractFactor)
input = max(0, cleanMid - treble × moverRTrebleSub)
```

### PERFIL LATINO — Valores actuales

#### 7.1 (base):

**Mover L (El Galán) — envelopeTreble:**
| Parámetro | Valor | Comentario |
|-----------|-------|------------|
| gateOn | **0.02** | Casi abierto permanentemente |
| boost | **12.0** | Terminator Boost al máximo |
| crushExponent | **0.60** | Cóncava — infla valores bajos |
| decayBase | **0.72** | Inercia viscosa |
| decayRange | **0.05** | |
| maxIntensity | **0.85** | |
| squelchBase | **0.12** | Piso relajado |
| squelchSlope | **0.15** | |
| ghostCap | **0.06** | Suelo ligero entre notas |
| attackSlopeMin | **-0.05** | Sedado — señales lentas pasan |
| sustainedFlatVelocityMax | **0.50** | Umbral absurdo, nunca "plano" |
| sustainedSquelchStartFrames | **9999** | Nunca penaliza sostenidas |

**Mover L cross-filter:**
| Parámetro | Valor |
|-----------|-------|
| moverLHighMidWeight | **2.50** (Turbomegaboost) |
| moverLTrebleWeight | **1.50** |
| moverLMidWeight | **1.50** |
| moverLTonalThreshold | **0.45** |

**Mover R (La Dama) — envelopeVocal:**
| Parámetro | Valor | Comentario |
|-----------|-------|------------|
| gateOn | **0.02** | Casi abierto permanentemente |
| boost | **5.0** | Reducido para evitar saturación de siseos |
| crushExponent | **1.0** | Lineal |
| decayBase | **0.72** | |
| decayRange | **0.05** | |
| maxIntensity | **0.85** | |
| squelchBase | **0.08** | Piso moderado |
| squelchSlope | **0.15** | |
| ghostCap | **0.04** | Hilo de sustain rítmico |
| attackSlopeMin | **-0.05** | Sedado |
| sustainedFlatVelocityMax | **0.50** | Umbral absurdo |
| sustainedSquelchStartFrames | **9999** | Nunca penaliza |

**Mover R cross-filter:**
| Parámetro | Valor |
|-----------|-------|
| bassSubtractBase | **0.25** |
| bassSubtractRange | **0.20** |
| moverRTrebleSub | **0.15** |

#### 4.1 (overrides):

Los movers en 4.1 **NO se compactan** (pasan directos), así que heredan el base. Los overrides 4.1 solo ajustan los envelopes de movers para alinear con la compactación del resto:

**Mover L override41 — envelopeTreble:** (idéntico al base)
**Mover R override41 — envelopeVocal:** (idéntico al base)

**Override 4.1 adicional:**
| Parámetro | Valor | Comentario |
|-----------|-------|------------|
| moverLTonalThreshold | **0.99** | Desactivado para latino en 4.1 |

### Otros parámetros relevantes para hipersensibilidad

**Sidechain (movers):**
| Parámetro | 7.1 | 4.1 | Comentario |
|-----------|-----|-----|------------|
| sidechainDepth | **0.00** | **0.00** | Exterminado globalmente |
| snareSidechainDepth | **0.05** | **0.00** | Mínimo |

**Kick detection (afecta sidechain de movers):**
| Parámetro | Valor | Comentario |
|-----------|-------|------------|
| kickEdgeMinInterval | **60** | Más corto que techno (180) — dembow rápido |
| kickVetoFrames | **0** | Cero — la síncopa 3-3-2 no aguanta vetos |

**MorphFactor (afecta decay dinámico de movers):**
| Parámetro | Valor | Comentario |
|-----------|-------|------------|
| morphFloor | **0.45** | avgMid mínimo para arrancar morph |
| morphCeiling | **0.65** | avgMid máximo = morph pleno |

### Detección de hipersensibilidad

Los indicios de hipersensibilidad en los movers serían:
- `gateOn: 0.02` — **extremadamente bajo**, casi cualquier señal dispara
- `boost: 12.0` (Mover L) — **extremadamente alto**, amplifica 12× cualquier señal
- `crushExponent: 0.60` (Mover L) — **cóncava**, infla valores bajos al instante
- `attackSlopeMin: -0.05` — **negativo**, no filtra señales lentas
- `sustainedSquelchStartFrames: 9999` — **anti-sustain desactivado**

Los coeficientes más sensibles para ajustar serían:
1. **`gateOn`** — subirlo (0.02 → 0.08-0.12) filtra señal débil
2. **`boost`** — bajarlo (12.0 → 8.0-10.0) reduce amplificación
3. **`crushExponent`** — subirlo (0.60 → 0.80-1.0) hace la curva menos infladora
4. **`attackSlopeMin`** — subirlo (-0.05 → 0.02-0.05) requiere ataque real

¿Qué coeficientes quiere ajustar el Arquitecto?