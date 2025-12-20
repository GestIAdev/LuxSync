# WAVE 51: KEY STABILIZATION - "El Ancla" ⚓
## La Sala Ya No Tiene TDAH

**Fecha**: 2025-12-20  
**Estado**: ✅ IMPLEMENTADO  
**Build**: Exitoso ✅  
**Commit**: `da46894`

---

## 🎯 PROBLEMA RESUELTO

### Antes de WAVE 51
```
Canción en DO MAYOR:
- Frame 1: Key=C → Rojo
- Frame 10: Acorde de paso F → Verde (¡FLASH!)
- Frame 15: Key=C → Rojo
- Frame 30: Acorde de paso G → Azul (¡FLASH!)
- Frame 35: Key=C → Rojo
→ RESULTADO: Epilepsia cromática 🚨
```

### Después de WAVE 51
```
Canción en DO MAYOR:
- Frame 1-300: StableKey=C → Rojo constante
- Frame 10: InstantKey=F (ignorado, es acorde de paso)
- Frame 30: InstantKey=G (ignorado, es acorde de paso)
- Frame 500: DJ mezcla nuevo track en G
- Frame 500-680: Key=G dominante (votación)
- Frame 680: StableKey cambia C→G → Azul (transición suave)
→ RESULTADO: Colores estables ✅
```

---

## 🏗️ ARQUITECTURA

### Nuevo Módulo: `KeyStabilizer.ts`

```
electron-app/src/main/selene-lux-core/engines/visual/
├── SeleneColorEngine.ts    (genera paleta desde Key)
├── SeleneColorInterpolator (interpola transiciones)
└── KeyStabilizer.ts        ⚓ NUEVO - Estabiliza la Key
```

### Flujo de Datos

```
senses.ts                     mind.ts                    SeleneColorEngine
    │                            │                            │
    │ harmony.key = "F"          │                            │
    │ (acorde de paso)           │                            │
    └──────────────────────────→ │                            │
                                 │ ⚓ KeyStabilizer.update()   │
                                 │ → stableKey = "C"          │
                                 │ (F no domina buffer)       │
                                 │                            │
                                 │ stabilizedAnalysis =       │
                                 │   {..., key: "C"}          │
                                 └──────────────────────────→ │
                                                              │ baseHue = KEY_TO_HUE["C"]
                                                              │ → 0° (Rojo)
                                                              │
                                                              │ (Sin cambio de color)
```

---

## 📊 PARÁMETROS DE CONFIGURACIÓN

```typescript
const keyStabilizer = new KeyStabilizer({
  bufferSize: 480,           // 8 segundos de historia @ 60fps
  lockingFrames: 180,        // 3 segundos para confirmar cambio
  dominanceThreshold: 0.35,  // Key debe tener >35% de votos
  minConfidence: 0.3,        // Ignorar detecciones débiles
  useEnergyWeighting: true,  // Drops pesan más que intros
  energyPower: 1.5,          // energia^1.5 para peso
});
```

### Explicación de Parámetros

| Parámetro | Valor | Significado |
|-----------|-------|-------------|
| **bufferSize** | 480 frames | 8 segundos de memoria (~32 compases @ 120BPM) |
| **lockingFrames** | 180 frames | Nueva key debe dominar 3 segundos antes de cambiar |
| **dominanceThreshold** | 0.35 | Key debe tener >35% de votos para ser "dominante" |
| **minConfidence** | 0.3 | Detecciones con <30% confianza no votan |
| **useEnergyWeighting** | true | Votos en alta energía (drops) pesan más |
| **energyPower** | 1.5 | Exponente: drop a E=1.0 tiene ~2.8x peso vs intro a E=0.3 |

---

## 🔬 ALGORITMO: VOTACIÓN PONDERADA

### Paso 1: Calcular Peso del Voto

```typescript
// Cada frame vota con un peso basado en energía
let weight = 1.0;

// Ignorar votos de baja confianza
if (input.confidence < 0.3) weight = 0;

// Ponderar por energía: drops tienen más influencia
if (useEnergyWeighting) {
  weight = Math.pow(energy, 1.5);
  // E=0.3 → peso=0.16
  // E=0.7 → peso=0.59
  // E=1.0 → peso=1.0
}
```

### Paso 2: Buffer Circular

```typescript
// Almacenar los últimos 480 frames (8 segundos)
keyBuffer[bufferIndex] = { key: "F", weight: 0.45 };
bufferIndex = (bufferIndex + 1) % 480;
```

### Paso 3: Calcular MODA

```typescript
// Sumar pesos por key
const votes = {
  "C": 45.2,   // 55% de votos ponderados
  "F": 12.3,   // 15% (acordes de paso)
  "G": 8.7,    // 10%
  "Am": 15.8,  // 20%
};

// C es dominante (>35% threshold)
const dominantKey = "C";
```

### Paso 4: Locking

```typescript
// Si la dominante es diferente de stableKey...
if (dominantKey !== stableKey) {
  candidateKey = dominantKey;
  candidateFrames++;
  
  // ¿Ha sido dominante por 3 segundos (180 frames)?
  if (candidateFrames >= 180) {
    stableKey = candidateKey;  // ¡CAMBIO DE KEY!
    candidateFrames = 0;
  }
}
```

---

## 📈 ESCENARIOS DE USO

### Escenario 1: Canción Estable (Lo Común)

```
Track: Techno en Do menor
Duración: 5 minutos
Keys detectadas: 95% Cm, 3% Fm, 2% Gm (acordes de paso)

→ stableKey = "C" durante toda la canción
→ Color base: ROJO constante
→ Solo varía S/L por energía
```

### Escenario 2: Modulación Real

```
Track: Progressive Trance
0:00-2:30: Key = Am (La menor)
2:30-2:45: Transición (modulación a Em)
2:45-5:00: Key = Em (Mi menor)

Frame 0-4500:     stableKey = "A"
Frame 4500-4680:  candidateKey = "E", progreso 0→100%
Frame 4680+:      stableKey = "E" (KEY CHANGE logged)
```

### Escenario 3: DJ Mix (Cambio de Track)

```
Track A (House en G): 0:00-3:00
Track B (Techno en D): 2:30-5:30 (overlap)

2:30-2:50: Votes divididas G/D
2:50-3:00: D empieza a dominar
3:00+:     D es dominante >3s → stableKey = "D"
```

---

## 🔗 INTEGRACIÓN EN MIND.TS

### Código Añadido

```typescript
// ⚓ WAVE 51: KEY STABILIZATION
const keyStabilizerOutput = state.keyStabilizer.update({
  key: harmony.key,
  confidence: harmony.confidence,
  energy: analysis.energy,
});

// Crear copia con key estabilizada
const stabilizedAnalysis = {
  ...analysis,
  wave8: {
    ...wave8,
    harmony: {
      ...harmony,
      key: keyStabilizerOutput.stableKey,  // ⚓ Key estable
    },
  },
};

// Generar paleta con key estabilizada
const selenePalette = SeleneColorEngine.generate(stabilizedAnalysis);
```

---

## 📋 LOGS DE DEBUG

### Log Periódico (cada 5 segundos)

```
[KeyStabilizer] ⚓ Stable=C Candidate=- Progress=0% Votes=[C:55%, Am:20%, F:15%]
```

### Log de Cambio de Key (evento raro)

```
[KeyStabilizer] 🎵 KEY CHANGE: C → G (after 180 frames, 3 total changes)
```

### Log de Inicialización

```
[KeyStabilizer] 🎵 Initial key detected: C
```

---

## ⚡ IMPACTO EN RENDIMIENTO

| Métrica | Valor |
|---------|-------|
| Memoria adicional | ~4KB (480 entries × 8 bytes) |
| CPU por frame | ~0.01ms (suma de pesos + comparación) |
| Latencia de reacción | 0ms (key instantánea disponible) |
| Latencia de cambio | 3 segundos (by design) |

---

## 🎨 RESULTADO VISUAL

### Antes (WAVE 50)
- Acordes de paso → Flash de color
- Modulaciones breves → Cambio completo
- DJ mixing → Caos de colores

### Después (WAVE 51)
- Acordes de paso → Ignorados (no hay flash)
- Modulaciones breves → Ignoradas si <3s
- DJ mixing → Transición suave solo cuando nuevo track domina

---

## ✅ CHECKLIST

- [x] Crear clase `KeyStabilizer`
- [x] Buffer circular de 8 segundos
- [x] Votación ponderada por energía
- [x] Locking de 3 segundos
- [x] Integrar en `mind.ts`
- [x] Build exitoso
- [x] Commit + Push

---

## 🚀 PRÓXIMOS PASOS

### WAVE 52: ENERGY (El Motor) 🏎️
- Mapear energía a Saturación/Brillo
- "Respiración visual" sincronizada con música

### WAVE 53: MOOD (La Emoción) 🎭
- Histéresis Mayor/Menor
- Transiciones frío↔calor más suaves

### WAVE 54: STRATEGY (El Contraste) 🎨
- Decidir analogous vs complementary
- Según syncopation + sección

---

## 💬 CONCLUSIÓN

> **WAVE 51: La sala ya no tiene TDAH.**
> 
> Si suena una canción en Do Mayor, la sala se mantiene ROJA
> aunque suenen acordes de Fa (Verde) o Sol (Azul).
> 
> El color solo cambia cuando la canción REALMENTE modula
> o el DJ mezcla otro track.
> 
> **"El Ancla ha fondeado. La Key es estable."** ⚓

---

*WAVE 51 - Key Stabilization - "The Anchor"* ⚓🎵
