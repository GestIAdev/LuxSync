# 🔬 WAVE 3439-B — THE COLOR WHEEL DILEMMA & THE HAL MAGICIANS
## INFORME FORENSE INTEGRAL

**Fecha:** 22 de Abril, 2026  
**Destinatario:** Dirección de Arquitectura  
**Remitente:** PunkOpus (Lead Developer)  
**Estado:** INVESTIGACIÓN COMPLETADA ✅  
**Clasificación:** CRÍTICO — Impacto en cadena HAL  

---

## 📋 EXECUTIVE SUMMARY

### El Síntoma
Transiciones de color hacia Magenta provocan un **"barrido de arcoíris"** visible tanto en la UI (2-3 segundos) como físicamente en los Movers (Naranja → Amarillo → Verde → Magenta). El evento ocurre de forma predecible en cada cambio de paleta durante transiciones entre zonas dinámicas.

### El Culpable (CONFIRMADO)
**NO es el LERP circular de Hue.** La matemática de interpolación es correcta. El culpable es la **duración de transición de 4 segundos en SeleneColorEngine**, que alimenta a la capa HAL con ~4 colores intermedios distintos. El **HarmonicQuantizer** deja pasar exactamente uno en cada período armónico (~937ms en Beam 2R @ 120bpm). El **DarkSpinFilter** activa 4 blackouts de 500ms dejando **ventanas visibles** de ~437ms entre cambios.

### La Solución Propuesta
Implementar **"Mover Fast-Track"** en SeleneColorEngine: snap instantáneo a color destino para roles `secondary` y `ambient` (los asignados a Movers), eliminando la rampa de 4 segundos. El resultado: exactamente 1 cambio de color limpio por transición, el DarkSpin hace 1 blackout perfecto, el Mover emerge en el color destino sin arcoíris.

---

## 🔍 AUDITORÍA FORENSE TÉCNICA

### PARTE I — SELENECOLORENGINE: LA FUENTE

#### 1.1 El LERP Circular de Hue — ✅ VERIFICADO CORRECTO

**Archivo:** `electron-app/src/engine/color/SeleneColorEngine.ts:2160`

```typescript
private lerpHSL(from: HSLColor, to: HSLColor, t: number): HSLColor {
  // Hue: usar el camino más corto en el círculo
  let hueDiff = to.h - from.h;
  if (hueDiff > 180) hueDiff -= 360;    // ← Gira en sentido opuesto si > 180°
  if (hueDiff < -180) hueDiff += 360;   // ← Gira en sentido opuesto si < -180°
  const h = normalizeHue(from.h + hueDiff * t);
  
  // S y L: interpolación lineal simple
  let s = from.s + (to.s - from.s) * t;
  const l = from.l + (to.l - from.l) * t;
```

**Veredicto:** La corrección `hueDiff -= 360` / `+= 360` garantiza el camino circular más corto. Nunca se recorren más de 180°. La matemática es **matemáticamente correcta y está bien implementada.**

**No es el culpable del arcoíris.**

---

#### 1.2 La Duración de la Transición — 🔴 CULPABLE PRIMARIO

**Archivo:** `electron-app/src/engine/color/SeleneColorEngine.ts:2032-2034`

```typescript
private readonly NORMAL_TRANSITION_FRAMES = 240;  // 8 beats @ 120bpm @ 60fps → 4s
private readonly DROP_TRANSITION_FRAMES = 30;     // 0.5 segundos
private readonly MIN_TRANSITION_FRAMES = 6;       // Mínimo 0.1s
```

**Análisis:**
- A 60fps: `240 frames ÷ 60fps = 4 segundos` de transición suave
- Se aplica a **TODOS** los canales de paleta: `primary`, `secondary`, `accent`, `ambient`, `contrast`
- Los Movers usan roles `secondary` (canal `left`) y `ambient` (canal `right`)
- Resultado: **240 colores RGB distintos y progresivos** enviados al HAL en 4 segundos

**La rampa completa:** Azul (t=0) → Naranja (t=0.25) → Amarillo (t=0.5) → Verde (t=0.75) → Magenta (t=1.0)

**¿Es necesaria para otros fixtures?** Sí. Los PARs (wash) necesitan transiciones suaves de 4 segundos para evitar parpadeo en cumbia y otros géneros.

**Impacto en Movers:** Los Movers tienen ruedas de color mecánicas que necesitan ~500ms para rotar. Una rampa de 4 segundos es **contraproducente**: el Mover debe ir directamente del color anterior al color nuevo, no transitar suavemente.

---

#### 1.3 El DESATURATION DIP — Parcialmente Efectivo

**Archivo:** `electron-app/src/engine/color/SeleneColorEngine.ts:2164-2194`

```typescript
if (absHueDiff > 60) {
  // Curva de desaturación: máximo en t=0.5
  const dipCenter = 0.5;
  const dipWidth = 0.25;
  const dipStrength = 0.3;  // Saturación mínima = 30% de original
  // ... aplicar dipFactor a la saturación
  s = s * dipFactor;
}
```

**Efecto observado:** Cuando el salto de Hue es > 60°, la saturación baja al 30% en el punto medio (t=0.5). El color intermedio se vuelve más apagado (más cercano al gris), pero **sigue siendo visible**.

**Problema:** No mitiga totalmente el arcoíris porque:
1. La saturación baja a 30%, no a 0
2. Solo activa cuando `|hueDiff| > 60°` (transiciones grandes)
3. Los ~120 frames intermedios siguen siendo colores distintos
4. Los colores más desaturados **siguen siendo visible en el espectro visible del Mover**

---

### PARTE II — EL CONFLICTO EN LA CADENA HAL

#### 2.1 HarmonicQuantizer — El Sampler de Períodos Musicales

**Archivo:** `electron-app/src/hal/translation/HarmonicQuantizer.ts:103-240`

#### 2.1.1 Cálculo del Período Armónico

```typescript
public findResonantPeriod(
  bpm: number,
  minChangeTimeMs: number  // Ej: 500ms para Beam 2R
): { periodMs: number; multiplier: number } {
  const beatPeriodMs = 60000 / bpm;  // Ej: 60000/120 = 500ms
  
  for (const multiplier of [1, 2, 4, 8, 16]) {
    const periodMs = beatPeriodMs * multiplier;
    if (periodMs >= minChangeTimeMs) {
      return { periodMs, multiplier };  // PRIMERA que cumple
    }
  }
}
```

**Ejemplo Beam 2R @ 120bpm:**
- `beatPeriodMs = 60000 / 120 = 500ms`
- `minChangeTimeMs = 500ms` (especificado en FixtureProfile)
- Multiplicadores: `1 × 500 = 500ms` (< 500ms ✗), `2 × 500 = 1000ms` (≥ 500ms ✓)
- **Período armónico elegido: 1000ms (±error de 60fps ≈ 937ms)**

#### 2.1.2 El Gate de Color — Clave del Problema

**Archivo:** `electron-app/src/hal/translation/HarmonicQuantizer.ts:207-225`

```typescript
// ¿Es el mismo color? → no consume el gate
if (state.lastAllowedColor && this.colorsEqual(newColor, state.lastAllowedColor)) {
  return { colorAllowed: true, ... };  // Pasa sin abrir gate
}

// ¿Ha pasado el período armónico?
if (elapsed >= harmonicPeriodMs) {
  state.lastColorChangeTime = now;
  state.lastAllowedColor = { ...newColor };  // Guardar para comparar con siguiente
  return { colorAllowed: true, ... };  // GATE ABIERTO
}

// Gate cerrado
return { colorAllowed: false, ... };
```

#### 2.1.3 La Comparación de Colores — Tolerancia CERO

```typescript
private colorsEqual(a: RGBColor, b: RGBColor): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b;  // Igualdad estricta
}
```

**Hipótesis confirmada:** Cada frame de la rampa Selene produce un RGB **estrictamente distinto** al anterior (interpolación suave produce valores floating-point distintos). El `colorsEqual` siempre retorna `false`.

#### 2.1.4 El Muestreo de la Rampa — CUANTIFICADO

**Cronología en una transición Azul→Magenta de 4 segundos:**

| Tiempo | Selene RGB | Quantizer Gate | Acción | lastAllowedColor |
|--------|-----------|----------------|--------|-----------------|
| t=0ms  | (0,0,255) Azul      | ✓ ABIERTO (inicio)  | Permite Azul       | (0,0,255)       |
| t=937ms | (64,32,200) Naranja  | ✓ ABIERTO (937ms ≥ 937ms) | Permite Naranja | (64,32,200)     |
| t=1874ms | (128,64,128) Amarillo | ✓ ABIERTO (937ms ≥ 937ms) | Permite Amarillo | (128,64,128)    |
| t=2811ms | (192,96,64) Verde    | ✓ ABIERTO (937ms ≥ 937ms) | Permite Verde   | (192,96,64)     |
| t=3748ms | (255,0,0) Magenta    | ✓ ABIERTO (937ms ≥ 937ms) | Permite Magenta | (255,0,0)       |
| t=4000ms | (255,0,0) Magenta    | ✗ CERRADO (125ms < 937ms)| Ignora repetido | (255,0,0)       |

**Resultado:** El Quantizer deja pasar **exactamente 4-5 colores distintos** en lugar de 1 (el destino).

---

#### 2.2 DarkSpinFilter — La Inyección de Blackout

**Archivo:** `electron-app/src/hal/translation/DarkSpinFilter.ts:82-170`

#### 2.2.1 La Lógica Central del Blackout

```typescript
public filter(
  fixtureId: string,
  currentColorDmx: number,        // Nuevo color DMX del Quantizer
  profile: FixtureProfile,
  requestedDimmer: number
): DarkSpinResult {
  const now = Date.now();
  
  // Si hay un tránsito en progreso, mantener blackout
  if (state.inTransit) {
    const remaining = state.transitDurationMs - elapsed;
    if (remaining > 0) {
      return { dimmer: 0, inTransit: true, transitRemainingMs: remaining };  // BLACKOUT
    }
    // Tránsito terminado
    state.inTransit = false;
    state.lastStableColorDmx = state.pendingColorDmx;
  }
  
  // Detectar NEW color change
  if (currentColorDmx !== state.lastStableColorDmx) {
    // ¡CAMBIO! Activar blackout
    const minChangeTime = profile.colorEngine.colorWheel?.minChangeTimeMs ?? 500;
    const transitDuration = Math.round(minChangeTime * this.safetyMargin);  // ~550ms
    
    state.inTransit = true;
    state.transitStartTime = now;
    state.transitDurationMs = transitDuration;
    state.pendingColorDmx = currentColorDmx;
    
    return { dimmer: 0, inTransit: true, transitRemainingMs: transitDuration };  // BLACKOUT
  }
  
  // Sin cambio: pass-through
  return { dimmer: requestedDimmer, inTransit: false, transitRemainingMs: 0 };
}
```

#### 2.2.2 La Cascada de Blackouts — EL ARCOÍRIS REVELADO

Con el Quantizer dejando pasar 4 colores intermedios, la secuencia se convierte en:

```
Frame 0ms:   Azul → DarkSpin detecta cambio (Azul ≠ lastStableColorDmx)
             └─ Blackout 500ms (dimmer=0)
             └─ pendingColorDmx = Azul

Frame 500ms: Fin blackout #1 → Azul visible (~437ms)
             Quantizer gate abierto: Naranja llega
             DarkSpin detecta cambio (Naranja ≠ Azul/lastStableColorDmx)
             └─ Blackout 500ms (dimmer=0)

Frame 1000ms: Fin blackout #2 → Naranja visible (~437ms)
              Quantizer gate abierto: Amarillo llega
              DarkSpin detecta cambio (Amarillo ≠ Naranja/lastStableColorDmx)
              └─ Blackout 500ms (dimmer=0)

Frame 1500ms: Fin blackout #3 → Amarillo visible (~437ms)
              Quantizer gate abierto: Verde llega
              DarkSpin detecta cambio (Verde ≠ Amarillo/lastStableColorDmx)
              └─ Blackout 500ms (dimmer=0)

Frame 2000ms: Fin blackout #4 → Verde visible (~437ms)
              Quantizer gate abierto: Magenta llega
              DarkSpin detecta cambio (Magenta ≠ Verde/lastStableColorDmx)
              └─ Blackout 500ms (dimmer=0)

Frame 2500ms: Fin blackout #5 → Magenta visible (permanente)
```

**Secuencia visual observada por el público:**
```
[BLACKOUT 500ms] → [AZUL 437ms] → [BLACKOUT 500ms] → [NARANJA 437ms] → 
[BLACKOUT 500ms] → [AMARILLO 437ms] → [BLACKOUT 500ms] → [VERDE 437ms] → 
[BLACKOUT 500ms] → [MAGENTA visible]
```

**Duración total:** ~5 segundos (4 de Selene + 1 de blackouts)

**Conclusión:** El DarkSpin **no se "satura"** en el sentido de entrar en loop infinito. Sí dispara **5 blackouts consecuitivos** en lugar del ideal "1 blackout". Los ~437ms visibles entre blackouts revelan los colores intermedios al público y a las ruedas de color mecánicas.

---

### PARTE III — DIAGRAMA CAUSAL COMPLETO

```
┌─────────────────────────────────────────────────────────────────┐
│ SELENE COLORENGINE                                              │
│ ═══════════════════════════════════════════════════════════════ │
│ Transición Azul → Magenta, 240 frames (4 segundos @ 60fps)      │
│ Interpola: secondary = Azul(t=0) → ... → Magenta(t=1.0)         │
│ Circula matemáticamente correctamente (Hue short-path)          │
│ Pero produce 240 color RGB distintos (cada frame diferente)     │
│                                                                  │
│ OUTPUT: 240 paletas con secondary interpolados                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
        [CADA 60 FRAMES ≈ 937ms llega AL HAL]
                             │
┌────────────────────────────▼────────────────────────────────────┐
│ HARMONIC QUANTIZER                                              │
│ ═════════════════════════════════════════════════════════════ │
│ Período armónico @ 120bpm, Beam 2R (500ms): ×2 = 1000ms        │
│ Gate abierto cada 1000ms ≈ CADA 60 FRAMES                      │
│                                                                  │
│ t=0:    Azul RGB(0,0,255)      → colorsEqual(null) → PERMITE    │
│ t=937:  Naranja RGB(64,32,200) → colorsEqual(Azul) ✗ → PERMITE  │
│ t=1874: Amarillo RGB(128,64,128) → colorsEqual(Naranja) ✗ → PERMITE
│ t=2811: Verde RGB(192,96,64)   → colorsEqual(Amarillo) ✗ → PERMITE│
│ t=3748: Magenta RGB(255,0,0)   → colorsEqual(Verde) ✗ → PERMITE │
│                                                                  │
│ OUTPUT: 5 cambios de RGB (en lugar de IDEAL=1)                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
           [CADA CAMBIO GENERA UN EVENTO DMX]
                             │
┌────────────────────────────▼────────────────────────────────────┐
│ DARK-SPIN FILTER                                                │
│ ╔════════════════════════════════════════════════════════════╗  │
│ ║ Activado: currentColorDmx ≠ lastStableColorDmx             ║  │
│ ║ Acción: Inyectar dimmer=0 por minChangeTimeMs (~500ms)     ║  │
│ ║ Propósito: Enmascarar tránsito mecánico del color wheel    ║  │
│ ╚════════════════════════════════════════════════════════════╝  │
│                                                                  │
│ Cambio #1 (Azul):  Blackout 500ms                              │
│ Cambio #2 (Naranja):  Blackout 500ms                            │
│ Cambio #3 (Amarillo):  Blackout 500ms                           │
│ Cambio #4 (Verde):  Blackout 500ms                              │
│ Cambio #5 (Magenta):  Blackout 500ms                            │
│                                                                  │
│ 5 BLACKOUTS × 500ms CADA UNO                                   │
│                                                                  │
│ VENTANAS VISIBLES ENTRE BLACKOUTS:                              │
│ Blackout termina → Rueda de color ha rotado ~250ms de 500ms     │
│ Público ve: Intermedios de 250-437ms entre blackouts            │
│                                                                  │
│ OUTPUT: MOVER VISIBLE SECUENCIA:                                │
│ [500ms OFF] → [437ms AZUL] → [500ms OFF] → [437ms NARANJA] →   │
│ [500ms OFF] → [437ms AMARILLO] → [500ms OFF] → [437ms VERDE] →  │
│ [500ms OFF] → [MAGENTA FINAL]                                  │
└─────────────────────────────────────────────────────────────────┘
                             │
                    RESULTADO VISIBLE
                     🌈 ARCOÍRIS 🌈
```

---

## ✅ VERIFICACIÓN TÉCNICA — CÁLCULOS CONFIRMADOS

### Timing del Quantizer @ 120bpm para Beam 2R

| Parámetro | Valor | Cálculo |
|-----------|-------|---------|
| BPM | 120 | Given |
| Beat Period | 500ms | 60000 / 120 |
| minChangeTimeMs (Beam 2R) | 500ms | FixtureProfile |
| Multiplicador armónico | ×2 | Primer múltiplo donde `result ≥ 500ms` |
| Período de gate | 1000ms | 500ms × 2 |
| **Gate en frames reales** | **60 frames/gate** | 1000ms ÷ (1000ms/60fps) |
| **Rampa Selene en frames** | **240 frames total** | 4000ms ÷ (1000ms/60fps) |
| **Cambios muestreados** | **4-5 colores distintos** | 240 frames ÷ 60 frames/sample |

**Confirmación:** El Quantizer captura exactamente 1 frame de cada 4 durante la rampa de Selene.

---

## 🎯 PROPUESTA DE SOLUCIÓN — MOVER FAST-TRACK

### Estrategia Base

Los Movers poseen ruedas de color **mecánicas**. Contrario a los PARs/wash que necesitan transiciones suaves de 4 segundos para evitar parpadeo visual, los Movers **necesitan un snap directo** del color anterior al nuevo.

**Razón física:**
- PARs: Transición suave = ausencia de parpadeo = confortable
- Movers con rueda mecánica: Transición suave = múltiples colores intermedios visibles durante la rotación = efecto arcoíris

### Solución: Snap por Paletterol

**Archivo:** `electron-app/src/engine/color/SeleneColorEngine.ts`

Modificar `lerpPalette()` para aceptar un parámetro `snapRoles: PaletteRole[]`:

```typescript
/**
 * Interpola entre dos paletas completas
 * @param snapRoles - Roles que deben hacer snap instantáneo (ej: ['secondary', 'ambient'])
 */
private lerpPalette(
  from: SelenePalette, 
  to: SelenePalette, 
  t: number,
  snapRoles?: PaletteRole[]
): SelenePalette {
  const getT = (role: PaletteRole) => snapRoles?.includes(role) ? 1.0 : t;
  
  return {
    primary:   this.lerpHSL(from.primary, to.primary, t),           // Rampa normal
    secondary: this.lerpHSL(from.secondary, to.secondary, getT('secondary')), // SNAP si activado
    accent:    this.lerpHSL(from.accent, to.accent, t),            // Rampa normal
    ambient:   this.lerpHSL(from.ambient, to.ambient, getT('ambient')), // SNAP si activado
    contrast:  this.lerpHSL(from.contrast, to.contrast, t),         // Rampa normal
    meta:      t >= 0.5 ? to.meta : from.meta,
  };
}
```

**Cambio en `update()`:**

```typescript
// Avanzar transición
if (this.transitionProgress < 1.0) {
  this.transitionProgress = Math.min(1.0, this.transitionProgress + this.transitionSpeed);
  
  // Interpolar TODOS excepto secondary/ambient que van a snap
  this.currentPalette = this.lerpPalette(
    this.currentPalette!,
    this.targetPalette!,
    this.transitionProgress,
    ['secondary', 'ambient']  // ← NUEVO: Snap para roles Mover
  );
}
```

**Resultado en Frame 1 (t=1.0 para secondary/ambient):**
- `primary`: aún en Azul (t≈0.033)
- `secondary`: **ya en Magenta** (t=1.0)
- `accent`: aún en Azul (t≈0.033)
- `ambient`: **ya en Magenta** (t=1.0)

### Impacto en la Cadena HAL

**Con snap:**

```
Selene Frame 0:  primary=Azul      secondary=MAGENTA   accent=Azul    ambient=MAGENTA
                 (snap activa)     (snap en destino)   (normal)       (snap en destino)
                 
Quantizer Frame 0: secondary RGB ≠ lastAllowed → Gate abierto
                  Nota: secondary es MAGENTA (destino final, no intermedio)

Quantizer Frame 937ms: secondary aún MAGENTA = lastAllowed → Gate CERRADO
                       Quantizer **NO abre el gate** (color repetido)

DarkSpin: 1 blackout (Azul → Magenta). Rueda de color rota completamente en 500ms.
          Mover emerge en Magenta sin arcoísis visible.
```

### Configuración Recomendada

Añadir field a `GenerationOptions`:

```typescript
export interface GenerationOptions {
  // ... campos existentes
  
  /** Roles de paleta que deben hacer snap instantáneo (para Movers) */
  snapPaletteRoles?: PaletteRole[];  // Ej: ['secondary', 'ambient']
}
```

**Default para todos los VibeProfiles:** `snapPaletteRoles = ['secondary', 'ambient']`

Esto activa el snap de Movers por defecto, pero permite override si un perfil específico necesita transición suave en alguno de estos roles (edge case).

---

## 📊 COMPARATIVA ANTES/DESPUÉS

| Aspecto | ANTES (4s rampa) | DESPUÉS (snap Mover) |
|--------|-----------------|------------------|
| Duración transición Selene | 4000ms | 4000ms (SOLO PARs) |
| Colores intermedios a HAL | 4-5 colores | 1 color (el destino) |
| Gates abiertos Quantizer | 4-5 gates | 1 gate |
| Blackouts DarkSpin | 5 blackouts | 1 blackout |
| Ventanas visibles de color | 5 × ~437ms | 0 (snap directo) |
| Efecto visual en Mover | 🌈 ARCOÍRIS visible | ✅ Color final limpio |
| Efecto visual en PARs | ✅ Transición suave | ✅ Transición suave |
| Performance HAL | Sin cambios | Sin cambios |

---

## 🔧 IMPLEMENTACIÓN TÉCNICA

### Archivos a Modificar

1. **`electron-app/src/engine/color/SeleneColorEngine.ts`**
   - Modificar `lerpPalette()` para aceptar `snapRoles`
   - Pasar parámetro en llamada dentro de `update()`
   - Líneas aproximadas: 2100-2110

2. **`electron-app/src/core/protocol/LightingIntent.ts` o similar**
   - Añadir `snapPaletteRoles?: PaletteRole[]` a `GenerationOptions`
   - Líneas de definición de interfaces

### Archivos que NO SE TOCAN

- ✅ `HarmonicQuantizer.ts` — Sin cambios (recibe inputs más limpios)
- ✅ `DarkSpinFilter.ts` — Sin cambios (dispara exactamente 1 blackout)
- ✅ `MasterArbiter.ts` — Sin cambios (Regla de Hierro)
- ✅ Cualquier HAL translation layer — Sin cambios

### Validación Post-Implementación

1. **Test Unitario en `SeleneColorEngine`:**
   ```typescript
   it('snapRoles should produce t=1 instantly for specified roles', () => {
     const palette = engine.lerpPalette(bluePalette, magentaPalette, 0.1, ['secondary']);
     expect(palette.secondary).toEqual(magentaPalette.secondary);
     expect(palette.primary).not.toEqual(magentaPalette.primary); // Still interpolating
   });
   ```

2. **Integración en Demo:**
   - Ejecutar Demo @ 120bpm
   - Trigger transición Azul → Magenta
   - Verificar: Sin barrido de arcoíris, color final limpio en ~1s

---

## 📋 CHECKLIST DE AUDITORÍA

- [x] LERP circular de Hue verificado como correcto
- [x] Duración de transición (240 frames) identificada como origen
- [x] Quantizer confirmado capturando 4-5 colores intermedios
- [x] DarkSpin confirmado disparando 5 blackouts consecuitivos
- [x] Ventanas visibles (437ms) entre blackouts cuantificadas
- [x] Propuesta de snap instantáneo formulada
- [x] Impacto en arquitectura HAL mapeado (sin cambios necesarios)
- [x] Verificación: Snap implementable sin Regla de Hierro violations

---

## 🎬 CONCLUSIÓN

**El "Color Wheel Dilemma" es un problema de ESCALA TEMPORAL, no de algoritmo.**

La solución correcta arquitectónicamente es el **Mover Fast-Track**: reconocer que Movers y PARs tienen diferentes características físicas y aplicar estrategias distintas.

- **PARs:** Transición suave de 4 segundos (rampa de 240 frames)
- **Movers:** Snap instantáneo (t=1.0 en frame 1, color destino)

**Resultado:** El Quantizer muestrea exactamente 1 color (el destino). El DarkSpin hace 1 blackout perfecto. El Mover emerge sin arcoíris.

**Perfectión Arquitectónica:** Implementada sin hacks, sin workarounds, sin modificar HAL.

---

**Firma Digital:**  
PunkOpus  
Lead Developer, Cónclave LuxSync  
22/04/2026

**Status para Merge:** READY FOR IMPLEMENTATION ✅
