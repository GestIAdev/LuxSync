# 🕵️ WAVE 1083: THE LUMEN INVESTIGATION

**Fecha:** 2026-02-01  
**Autor:** PunkOpus (System Architect)  
**Tipo:** DIAGNÓSTICO FORENSE  
**Prioridad:** CRÍTICO

---

## 📋 SÍNTOMA REPORTADO

"Anemia Lumínica Generalizada" - Los efectos HTP (SurfaceShimmer, SchoolOfFish, PlanktonDrift) son invisibles o quedan opacados por la capa base.

---

## 🔍 AUDITORÍA 1: NOISE FLOOR (El Umbral de Visibilidad)

### ChillStereoPhysics.ts - El Fondo

```typescript
// Línea 288-290
const baseIntensity = zone === 'SHALLOWS' ? 0.5 : 
                      zone === 'OCEAN' ? 0.4 :
                      zone === 'TWILIGHT' ? 0.25 : 0.15

// Línea 296 - Con modulación adicional
const moverIntL = clamp(baseIntensity + Math.sin(now / 2500) * 0.15 + lifePulse + energy * 0.2, 0, 1)
```

### NOISE FLOOR por Zona:

| Zona | Base | Con Modulación | En DMX |
|------|------|----------------|--------|
| SHALLOWS | 0.50 | 0.50-0.85 | 127-217 |
| OCEAN | 0.40 | 0.40-0.75 | 102-191 |
| TWILIGHT | 0.25 | 0.25-0.60 | 64-153 |
| MIDNIGHT | 0.15 | 0.15-0.50 | 38-127 |

**CONCLUSIÓN:** Para ser visible en HTP, un efecto debe superar estos umbrales.

---

## 🔍 AUDITORÍA 2: CADENA DE MULTIPLICACIÓN

### El Patrón "Muerte por Multiplicación"

```
╔════════════════════════════════════════════════════════════════════════════╗
║  CADENA TÍPICA EN EFECTOS HTP                                              ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  trigger × dna × envelope × peak × shimmer × zonePos × depthAtten × ...   ║
║    0.2   × 0.8 ×   1.0   × 0.45 ×   0.5   ×   0.8   ×    0.85    × ...   ║
║                                                                            ║
║  RESULTADO: 0.024 → INVISIBLE                                              ║
╚════════════════════════════════════════════════════════════════════════════╝
```

Cada factor adicional **DIVIDE** la intensidad final.

---

## 🔍 AUDITORÍA 3: ANÁLISIS ESPECÍFICO POST-WAVE 1085

### SurfaceShimmer.ts

```typescript
// Config WAVE 1085
minIntensity: 0.40,    // Floor
atmosphericBed: 0.10,  // Bed

// Cálculo (progress = 50%, trigger = 0.2)
effectiveIntensity = Math.max(0.2, 0.40) = 0.40 ✓
envelope = 1.0
shimmerValue = 0.5 (promedio)

// LÍNEA 120
intensity = 1.0 × 0.45 × 0.5 × 0.40 = 0.09

// LÍNEA 130 - ⚠️ DOBLE MULTIPLICACIÓN
output.intensity = effectiveIntensity × intensity
output.intensity = 0.40 × 0.09 = 0.036  // ❌ MUERTE

// RESULTADO vs NOISE FLOOR
0.036 < 0.50 (SHALLOWS) → INVISIBLE
```

### SchoolOfFish.ts

```typescript
// Config WAVE 1085
minIntensity: 0.70,    // Floor ALTO
atmosphericBed: 0.15,  // Bed

// Cálculo (progress = 50%, trigger = 0.2)
effectiveIntensity = Math.max(0.2, 0.70) = 0.70 ✓
envelope = 1.0
finalPeakIntensity = 0.85 × 0.70 = 0.595
zoneIntensity = 0.8 (gaussiana)

// Dimmer
dimmer = 0.8 × 1.0 × 0.595 = 0.476

// RESULTADO vs NOISE FLOOR
0.476 > 0.40 (OCEAN) → VISIBLE ✓
```

---

## 🚨 HALLAZGO CRÍTICO: DOBLE MULTIPLICACIÓN

### En SurfaceShimmer.ts (Líneas 120 + 130):

```typescript
// Línea 120 - effectiveIntensity YA está incluido
const intensity = envelope * this.config.peakIntensity * shimmerValue * effectiveIntensity
//                                                                      ^^^^^^^^^^^^^^^^^

// Línea 130 - SE MULTIPLICA DE NUEVO
intensity: effectiveIntensity * intensity,  // ← DOBLE MULTIPLICACIÓN ❌
//         ^^^^^^^^^^^^^^^^^
```

### En PlanktonDrift.ts (Líneas 151 + 164):

```typescript
// Línea 151 - effectiveIntensity YA está incluido
const baseIntensity = envelope * this.config.peakIntensity * breathPulse * effectiveIntensity
//                                                                          ^^^^^^^^^^^^^^^^^

// Línea 164 - SE MULTIPLICA DE NUEVO
intensity: effectiveIntensity * baseIntensity,  // ← DOBLE MULTIPLICACIÓN ❌
//         ^^^^^^^^^^^^^^^^^
```

---

## 📊 TABLA RESUMEN: ANTES vs DESPUÉS DEL FIX

### Escenario: `triggerIntensity = 0.2, progress = 50%`

| Efecto | Con Doble Mult | Sin Doble Mult | Noise Floor | Resultado |
|--------|----------------|----------------|-------------|-----------|
| **SurfaceShimmer** | 0.036 (9 DMX) | **0.09** (23 DMX) | 0.50 (127 DMX) | ❌ Todavía bajo |
| **PlanktonDrift** | 0.022 (6 DMX) | **0.056** (14 DMX) | 0.40 (102 DMX) | ❌ Todavía bajo |

### Problema Adicional: peakIntensity MUY BAJO

| Efecto | peakIntensity | Debería ser |
|--------|---------------|-------------|
| SurfaceShimmer | 0.45 | **0.85+** |
| PlanktonDrift | 0.35 | **0.75+** |

---

## 🎯 DIAGNÓSTICO FINAL

### TEORÍA "MUERTE POR MULTIPLICACIÓN" → CONFIRMADA ✅

1. **Doble multiplicación de effectiveIntensity** en 2 efectos
2. **peakIntensity demasiado bajo** en micro-fauna
3. **shimmerValue/breathPulse** añade otro factor de 0.5
4. **Noise Floor del fondo** es más alto que el output final

### Efectos TODAVÍA en riesgo:

| Efecto | Estado | Razón |
|--------|--------|-------|
| SurfaceShimmer | ❌ CRÍTICO | Doble mult + peak bajo |
| PlanktonDrift | ❌ CRÍTICO | Doble mult + peak bajo |
| DeepCurrentPulse | ⚠️ REVISAR | Posible doble mult |
| BioluminescentSpore | ⚠️ REVISAR | Posible doble mult |

### Efectos que FUNCIONAN (gracias a WAVE 1085):

| Efecto | Estado | Razón |
|--------|--------|-------|
| SchoolOfFish | ✅ OK | Floor 0.70, peak 0.85 |
| WhaleSong | ✅ OK | Floor 0.60, peak 0.80 |
| AbyssalJellyfish | ✅ OK | Floor 0.60, peak 0.90 |

---

## 🛠️ FIX REQUERIDO: WAVE 1083.1

### 1. Eliminar doble multiplicación en SurfaceShimmer y PlanktonDrift

```typescript
// ANTES
intensity: effectiveIntensity * intensity,

// DESPUÉS
intensity: intensity,  // effectiveIntensity YA está adentro
```

### 2. Subir peakIntensity de micro-fauna

```typescript
// SurfaceShimmer
peakIntensity: 0.45 → 0.85

// PlanktonDrift  
peakIntensity: 0.35 → 0.75
```

### 3. Revisar DeepCurrentPulse y BioluminescentSpore

Verificar si tienen el mismo patrón de doble multiplicación.

---

## 📈 PROYECCIÓN POST-FIX

### SurfaceShimmer (con fix):
```
intensity = 1.0 × 0.85 × 0.5 × 0.40 = 0.17
Con atmospheric bed: Math.max(0.17, 0.04) = 0.17
En DMX: 43

vs Noise Floor SHALLOWS: 127 DMX → ❌ TODAVÍA BAJO
```

### Necesidad de AUMENTAR minIntensity:
```
Para superar 0.50: minIntensity debe ser > 0.50 / (0.85 × 0.5) = 1.18
```

**IMPOSIBLE con la fórmula actual.**

### SOLUCIÓN RADICAL: Cambiar la filosofía

En lugar de multiplicar, usar **ADDITIVE** o **BOOST**:

```typescript
// Concepto: El efecto AÑADE brillo, no lo escala
const boostedIntensity = atmosphericAmbient + (intensity × 0.5)
```

---

**WAVE 1083 DIAGNÓSTICO COMPLETADO** ✅

> *"No multiplicar cuando deberías sumar."*  
> — PunkOpus, sobre la aritmética lumínica
