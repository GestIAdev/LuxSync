# 🔬 WAVE 2191: THE TRINITY FORENSIC AUDIT

**Fecha:** 2026-03-25  
**Auditor:** PunkOpus  
**Orden:** Radwulf — "Audita estos 3 sistemas y entrégame las pruebas del delito"  
**Restricción:** CERO código. Solo diagnóstico.

**Fixture bajo investigación:**  
`EL 1140 TESTING` — ID: `user-1770473024494-gooaf830g`  
Manufacturer: Chino | Type: moving-head | 10 canales | Sin 16-bit  
Ubicación: `%APPDATA%/luxsync-electron/fixtures/`

---

## INV 1: EL BLANCO PERPETUO

### Síntoma
El fixture SIEMPRE emite blanco por el canal DMX de color_wheel, sin importar qué color se seleccione desde el engine.

### Cadena de Ejecución Rastreada

```
MasterArbiter (color_wheel: 0 default)
  → HardwareAbstraction.renderFromTarget()
    → translateColorToWheel(state, fixture, existingColorWheel=0)
      → getFixtureProfileCached(fixture)
        → PASO 1: fixture tiene .capabilities → profile = fixture (inyección directa)
      → needsColorTranslation(profile)
        → capEngine = profile.capabilities.colorEngine → "rgb"
        → "rgb" NO matchea ['wheel', 'hybrid', 'rgbw', 'cmy']
        → RETORNA false ❌
      → translateColorToWheel RETORNA state SIN MODIFICAR
    → state.colorWheel permanece en 0
  → FixtureMapper emite DMX 0 en canal 5 (color_wheel) → BLANCO FÍSICO
```

### La Prueba del Delito

**Archivo:** `electron-app/src/hal/translation/FixtureProfiles.ts` líneas 345-360

```typescript
export function needsColorTranslation(profile: any): boolean {
  // 1. Formato Forja V2 (Nueva)
  const capEngine = profile.capabilities?.colorEngine
  if (capEngine === 'wheel' || capEngine === 'hybrid' || capEngine === 'rgbw' || capEngine === 'cmy') return true
  // ... más checks que tampoco matchean ...
  return false  // ← EL FIXTURE MUERE AQUÍ
}
```

**Archivo:** Fixture JSON del usuario (EL 1140 TESTING)

```json
"capabilities": {
    "hasColorWheel": true,        // ← DICE QUE TIENE RUEDA
    "hasColorMixing": false,
    "colorEngine": "rgb",         // ← PERO DICE QUE ES RGB ❌ CONTRADICTORIO
    "colorWheel": {
        "colors": [               // ← TIENE 14 COLORES MAPEADOS CON DMX
            { "dmx": 0, "name": "White", "rgb": { "r":255, "g":255, "b":255 } },
            { "dmx": 10, "name": "Pink", "rgb": { "r":255, "g":105, "b":180 } },
            { "dmx": 20, "name": "Cyan" },
            { "dmx": 30, "name": "Yellow" },
            // ... hasta 14 colores
        ]
    }
}
```

### Root Cause

**DOBLE FALLO:**

1. **La Forja (o el humano) escribió `colorEngine: "rgb"` cuando debería ser `"wheel"`.**  
   El fixture tiene `hasColorWheel: true`, tiene `colorWheel.colors` con 14 entradas, NO tiene canales RGB (red/green/blue)... pero dice `colorEngine: "rgb"`. Absurdo.

2. **`needsColorTranslation()` NO consulta `hasColorWheel`.**  
   Solo mira `colorEngine`. Si dice "rgb", le cree. No verifica la evidencia de que hay una rueda de colores con 14 posiciones DMX mapeadas.

### La Ironía

El `ColorTranslator` tiene la tabla de colores lista para funcionar:
```typescript
// ColorTranslator.ts línea 311
const colorWheel = profile.capabilities?.colorWheel  // ← SÍ existe con 14 colores
const hasWheelData = colorWheel?.colors?.length > 0   // ← VERDADERO
```

Pero NUNCA llega a ejecutarse porque `needsColorTranslation()` lo bloquea en la puerta.

### Escala del Impacto

Afecta a **CUALQUIER fixture** cuyo JSON tenga la combinación:
- `hasColorWheel: true` + `colorEngine: "rgb"` → color muerto

---

## INV 2: EL CAOS COREOGRÁFICO

### Síntoma
Los patrones de movimiento a veces se ven caóticos, como si el motor no siguiera un patrón coherente.

### Investigación del Motor

**Archivo:** `electron-app/src/engine/movement/VibeMovementManager.ts`

El motor fue restaurado en WAVE 2213 (Operación Fénix) con un acumulador de fase monotónico. La arquitectura es sólida:

- **Fase monotónica** (líneas 496-508): `phaseAccumulator += deltaBPM * dt / period * 2π`  
  Sin teleportaciones. La fase solo avanza.
  
- **BPM suavizado** (líneas 688-690): `smoothedBPM += (safeBPM - smoothedBPM) * 0.05`  
  Factor 0.05 = ~20 frames para converger. Resistente a fluctuaciones.

- **LERP de transición** (líneas 746-766): easeo Hermite de 2 segundos entre patrones.  
  Guard `isSameFrame` evita contaminación L/R estéreo.

- **Selección determinista** (líneas 887-898): `phrase = floor(barCount / 8)`, `index = phrase % patterns.length`  
  Sin aleatoriedad. Rotación cíclica cada 8 compases.

### Hallazgo

**El motor de movimiento está SANO.** El acumulador WAVE 2213 eliminó los tres problemas originales:

1. ~~Modulación de período por energía~~ → período FIJO por patrón
2. ~~BPM errático~~ → smoothedBPM con factor 0.05
3. ~~beatCount módulo~~ → acumulador monotónico

**El "caos" percibido NO viene del coreógrafo.** Viene de la combinación de:

- **physicsMode: 'classic'** en techno-club (ver INV 3) → inercia suaviza los targets lineales puros del VMM → los patrones geométricos pierden definición → parece "caótico" cuando es simplemente "borroso"
- **Amplitud contenida** (0.40 para techno) + **Gearbox con suelo de 85%** → el rango real de movimiento es pequeño → parece "nervioso" en un mover barato con baja resolución (8-bit sin fine)

### Veredicto

**INOCENTE.** El VibeMovementManager genera targets matemáticamente limpios. El problema es downstream (FPD + falta de resolución 16-bit).

---

## INV 3: LA GEOMETRÍA BLANDA

### Síntoma
Los patrones cuadrados parecen redondos. Los diamantes parecen círculos. Las esquinas no existen.

### Investigación

**Dato crucial del fixture real:**

```json
"channels": [
    { "index": 0, "type": "pan",   "is16bit": false },
    { "index": 1, "type": "tilt",  "is16bit": false },
    // NO HAY pan_fine NI tilt_fine
]
```

El EL 1140 TESTING tiene **10 canales sin 16-bit de movimiento**. Esto elimina la hipótesis INV 3 original (pan_fine/tilt_fine hardcoded a 0 en FixtureMapper).

### El Verdadero Culpable: physicsMode classic

**Archivo:** `electron-app/src/engine/movement/VibeMovementPresets.ts` líneas 98-100

```typescript
'techno-club': {
    physics: {
      physicsMode: 'classic',   // 🔥 WAVE 2213: Exorcismo del snap
```

**Archivo:** `electron-app/src/engine/movement/FixturePhysicsDriver.ts` líneas 697-750

El modo `classic` aplica física con inercia:
- Aceleración gradual al arrancar
- Deceleración gradual al frenar
- **Curva S** que redondea TODA transición de velocidad

Cuando el VMM genera un target `square` con esquinas duras:
```
Target:  ■ → esquina → ■ → esquina → ■  (cambio instantáneo de dirección)
```

El FPD en modo `classic` lo convierte en:
```
DMX real: ● → curva → ● → curva → ●  (deceleración + aceleración)
```

**Los cuadrados se redondean porque la INERCIA del modo classic impide el cambio instantáneo de dirección que requiere una esquina.** 

### WAVE 2213: El Exorcismo que Mató las Esquinas

WAVE 2213 cambió techno-club de `physicsMode: 'snap'` a `physicsMode: 'classic'` para eliminar "trayectorias sinusoidales continuas". Pero al hacerlo, destruyó la capacidad de los patrones geométricos (square, diamond, botstep) de mantener sus aristas.

**Antes (snap):**
- `snapFactor: 0.85` → el mover persigue el target con 85% del delta por frame
- El motor INTENTA llegar a la esquina → la inercia MECÁNICA del hardware la redondea naturalmente
- El patrón mantiene su identidad geométrica

**Ahora (classic):**
- Inercia + curva S + aceleración/deceleración
- El motor frena ANTES de la esquina y acelera DESPUÉS
- La esquina se convierte en curva ANTES de llegar al hardware
- El hardware (que ya de por sí redondea) recibe un target ya redondeado
- **Doble suavizado** = geometría muerta

### Agravantes

1. **Sin 16-bit:** 8 bits = 256 posiciones en 540° Pan = 2.1° por paso DMX. Las esquinas de un square con amplitude 0.40 solo recorren ~43 pasos DMX → muy poca resolución para dibujar ángulos rectos.

2. **Gearbox suelo 85%:** Con `GEARBOX_MIN_AMPLITUDE = 0.85`, la amplitud nunca baja de 85% del base. Si `amplitudeScale = 0.40` y el Gearbox lo sube a 0.85, la amplitud salta → inconsistencia con la intención del preset.

   **CORRECCIÓN:** El Gearbox tiene `Math.max(0.85, gearboxResult)` donde `gearboxResult = requestedAmplitude * gearboxFactor`. Si `requestedAmplitude = 0.40 * 1.2 (energyBoost) = 0.48` y `gearboxFactor = 1.0`, entonces `gearboxResult = 0.48` → se sube a `0.85`. La amplitud REAL siempre es 0.85 mínimo, ignorando el 0.40 del preset.

---

## RESUMEN EJECUTIVO

| INV | Bug | Culpable | Archivo Principal |
|-----|-----|----------|-------------------|
| **1** | Blanco Perpetuo | `colorEngine: "rgb"` + `needsColorTranslation()` no consulta `hasColorWheel` | `FixtureProfiles.ts:345` + Fixture JSON |
| **2** | Caos Coreográfico | **FALSO POSITIVO** — Motor sano. El "caos" es suavizado excesivo del FPD | `VibeMovementManager.ts` (inocente) |
| **3** | Geometría Blanda | `physicsMode: 'classic'` en techno + 8-bit sin fine + Gearbox suelo 85% | `VibeMovementPresets.ts:99` + `FixturePhysicsDriver.ts:697` |

### Conexión INV 2 ↔ INV 3

Los problemas 2 y 3 son **el mismo bug** visto desde distinto ángulo:
- INV 2 (caos) = los patrones no se ven nítidos → parece caótico
- INV 3 (blandura) = los patrones se redondean → parece que no hay geometría

**Ambos se resuelven con la misma intervención en el FixturePhysicsDriver.**

---

*Reporte entregado. Esperando órdenes del Arquitecto para WAVE 2192: THE SURGERY.*
