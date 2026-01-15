# WAVE 342.5: FRECUENCIAS FIJAS + SNAP UNIFICADO 🎛️

**Fecha:** 2026-01-09
**Tipo:** Arquitectura de Movimiento
**Status:** ✅ IMPLEMENTADO

---

## 🔍 DIAGNÓSTICO DEL PROBLEMA TECHNO

### Síntomas
- 2D: Metrónomo simple (izquierda-derecha)
- 3D: No se mueve
- Logs muestran saltos brutales de posición

### Causa Raíz: BPM INESTABLE

```
BPM=191 → BPM=184 → BPM=174 → BPM=170 → BPM=186
```

El patrón `mirror` usaba `mirrorFreq = context.bpm / 60 / 4`, causando:
- Cambios de fase cuando BPM cambia
- Saltos de +216° a -216° "instantáneos" (en realidad, discontinuidades de fase)
- Physics driver no podía seguir → parecía "atascado"
- 3D con LERP oscilaba cerca del centro

---

## 🔧 SOLUCIÓN: FRECUENCIAS FIJAS

### Principio Arquitectónico

> **Todos los patrones de movimiento usan frecuencias FIJAS, no dependientes de BPM.**

El BPM detectado es inestable (±30 BPM en segundos). Los patrones de movimiento deben ser PREDECIBLES.

### Frecuencias por Patrón

| Patrón | Frecuencia | Ciclo | Uso |
|--------|------------|-------|-----|
| figure8 | 0.1 Hz | 10 seg | Latino - curvas zen |
| circle | 0.05 Hz | 20 seg | Chill - rotación lenta |
| **mirror** | **0.4 Hz** | **2.5 seg** | **Techno - puertas urgentes** |
| sweep | Variable | - | Rock - barridos dramáticos |

---

## 🪞 PATRÓN MIRROR - WAVE 342.7: MÁS AGRESIVO

```typescript
case 'mirror':
  const mirrorFreq = 0.4  // Hz - URGENTE (era 0.25)
  
  // PAN: Oscilación lateral rápida con amplitud reactiva
  const mirrorAmp = amplitude * (0.8 + audio.energy * 0.2)
  centerX = 0.5 + Math.sin(timeSeconds * Math.PI * 2 * mirrorFreq) * mirrorAmp
  
  // TILT: Doble movimiento - búsqueda + punch
  const tiltOscillation = Math.sin(timeSeconds * Math.PI * 4 * mirrorFreq) * 0.2
  const bassHit = Math.pow(audio.bass, 3) * 0.35  // ^3 para punch explosivo
  centerY = 0.5 + tiltOscillation - bassHit  // Oscila Y golpea
  break
```

### Características:
- **PAN:** Sinusoidal a 0.4 Hz (2.5 seg/ciclo) con amplitud reactiva al energy
- **TILT:** Oscilación doble velocidad (0.8 Hz) + bass punch (bass³)
- **HAL:** Aplica mirror invertido para fixtures izq/der
- **Resultado:** Puertas que se abren/cierran con URGENCIA + cabeceo explosivo

---

## 🏎️ FÍSICA UNIFICADA: SNAP MODE

### Eliminación de INSTANT MODE

El modo "instantáneo" era problemático:
- Causaba saltos bruscos
- No respetaba física realista
- Conflicto con REV LIMITER muy bajo (6 DMX/frame)

### Nuevo Sistema: SNAP MODE Universal

```typescript
if (maxAccel > 1000) {
  // snapFactor escala con maxAccel
  // Techno (1500): 0.85 - muy reactivo
  // Latino (1200): 0.65 - fluido
  // Rock (1050):   0.46 - dramático
  const snapFactor = Math.min(0.85, 0.4 + (maxAccel - 1000) / 800)
  
  let deltaPan = (targetDMX.pan - current.pan) * snapFactor
  deltaPan = clamp(deltaPan, -REV_LIMIT_PAN, REV_LIMIT_PAN)
  
  newPos.pan = current.pan + deltaPan
}
```

### REV LIMITER Ajustado

| Vibe | PAN DMX/frame | Velocidad | Razón |
|------|---------------|-----------|-------|
| Techno | 15 | ~630°/s | Mirror suave, puede seguir |
| Latino | 25 | ~1050°/s | Figure8, necesita amplitud |
| Rock | 15 | ~630°/s | Sweeps dramáticos |
| Chill | 255 | Sin límite | Física clásica |

---

## 📊 RESULTADO ESPERADO

### Techno
- **PAN:** Oscilación suave ±216° cada 4 segundos
- **TILT:** Golpes con el kick (bass²)
- **Mirror:** Movers izq/der en espejo (HAL invierte)
- **Visualización:** 2D y 3D muestran el mismo patrón fluido

### Latino (sin cambios)
- Figure8 a 0.1 Hz
- Funciona correctamente en ambos canvas

---

## 📁 ARCHIVOS MODIFICADOS

1. **TitanEngine.ts** - Mirror con frecuencia fija 0.25 Hz + tilt reactivo
2. **FixturePhysicsDriver.ts** - SNAP MODE unificado, REV LIMITER ajustado
3. **useFixtureRender.ts** - 🔧 NORMALIZACIÓN DMX→0-1 (EL BUG CRÍTICO)

---

## 🐛 BUG CRÍTICO ENCONTRADO: DMX vs 0-1

### El Problema

```typescript
// FixtureMapper.ts genera:
pan: isMovingFixture ? Math.round(panValue * 255) : 0  // → 0-255 (DMX)

// useFixtureRender.ts ANTES (bug):
let pan = truthData?.pan ?? 0.5  // Espera 0-1, RECIBE 0-255!

// Fixture3D.tsx espera:
const panAngle = (pan - 0.5) * Math.PI * 0.8  // → EXPLOTA con pan=127
// (127 - 0.5) * 2.51 = 318 radianes = INFINITO
```

### La Solución

```typescript
// useFixtureRender.ts DESPUÉS (fix):
const rawPan = truthData?.pan ?? 127.5  // DMX (0-255)
let pan = rawPan / 255  // Normalizar a 0-1

// Ahora Fixture3D recibe 0-1:
// (0.5 - 0.5) * 2.51 = 0 radianes = CENTRO ✓
```

### ¿Por qué Latino funcionaba?

Latino con figure8 producía valores de pan DMX que oscilaban alrededor de 127.
Al dividir por 255 (aunque no se hacía), los valores "parecían" cerca del rango.
Pero Techno con mirror saltaba de extremo a extremo, haciendo el overflow más visible.

---

## 🎯 FILOSOFÍA DE LAS PUERTAS DEL INFIERNO

```
    ┌───────────────────────────────────────┐
    │         PUERTAS DEL INFIERNO          │
    │                                        │
    │   MOVER LEFT         MOVER RIGHT      │
    │      ←──               ──→            │  (PAN invertido)
    │        \               /              │
    │         \    ▼▼▼    /                │  (TILT compartido - bass punch)
    │          \   ▼▼   /                   │
    │           \  ▼  /                     │
    │            \   /                      │
    │             \/                        │
    │         AUDIENCIA                     │
    └───────────────────────────────────────┘
```

### Movimiento Mirror:
- **PAN (horizontal):** INVERTIDO entre LEFT/RIGHT
  - LEFT va derecha → RIGHT va izquierda
  - Crea efecto de puertas que se abren/cierran
  
- **TILT (vertical):** COMPARTIDO (mismo para ambos)
  - Oscilación de búsqueda: `sin(time * 4 * 0.4 Hz) * 0.2`
  - Bass punch: `bass³ * 0.35` (golpe hacia abajo)
  - Ambos movers apuntan al mismo nivel vertical

### Por qué NO invertir TILT:
- ✅ Puertas del infierno son movimiento **horizontal**
- ✅ Fixtures en línea (truss) necesitan apuntar a la misma altura
- ❌ Invertir tilt haría que un lado apunte al techo y otro al suelo

---

*"Los movers no son metrónomos. Son puertas que revelan el infierno."* - PunkOpus
