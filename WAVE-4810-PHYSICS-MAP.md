# ⚡ WAVE 4810 — THE PHYSICS LAB (L0 Map)
> Auditoría forense del pipeline de físicas L0 (LiquidEngine), defaults de canal, y distribución cromática por zona.
> Estado: Smart Gate (L2) operativo. Este documento es la base para dictar las nuevas reglas de comportamiento físico.

---

## 1. AUDITORÍA DE ZONAS — Diagrama de Flujo de Impacto

### 1.1 Arquitectura General

```
GodEarFFT bands ──► LiquidEngineBase.applyBands() ──► routeZones() ──► LiquidStereoResult ──► LiquidAetherAdapter ──► IIntentBus (L0)
```

`LiquidEngineBase` es **layout-agnostic**. Las clases hijas (`LiquidEngine41`, `LiquidEngine71`) solo implementan `routeZones()` — el mapeo de señales procesadas a zonas físicas.

### 1.2 Señales Internas (ProcessedFrame)

Cada frame, `applyBands()` computa 6 señales base + 3 zonas ampliadas (WAVE 4520.2):

| Señal | Fuente de Audio | Envelope | Descripción |
|-------|-----------------|----------|-------------|
| `frontLeft` | `subBass` | `envSubBass` | El Océano — sub continuo |
| `frontRight` | `kickEdge` | `envKick` | El Francotirador — bombo puro |
| `backLeft` | `mid` cross-filter | `envHighMid` | El Coro — sintetizadores |
| `backRight` | Transient Shaper | `envSnare` | El Látigo — caja/clap |
| `moverLeft` | `highMid+treble+mid` | `envTreble` | El Melodista / El Galán |
| `moverRight` | `mid` (vocal EQ) | `envVocal` | El Alma / La Dama |

**Zonas ampliadas (9-zone):**
| Zona | Fórmula | Comportamiento |
|------|---------|----------------|
| `floor` | `(subBass×0.65 + lowMid×0.35) × recoveryFactor` | Reacción instantánea al sub. AGC recovery atenua tras silencio. |
| `ambient` | `pow(EMA×gain, 3.5)` con noise-gate 0.15 | **ULTRA-COMPRIMIDA.** EMA lenta (~800ms attack, ~10s release). Cubic crush fuerza a negro rápido. Solo brilla en picos fuertes. |
| `air` | `soft-compressed EMA × recoveryFactor` | Treble+highMid con compresión `1-e^(-x*3)`. Gated por AGC. |

### 1.3 Diferencias 4.1 vs 7.1

#### 4.1 — Setup Compacto (`LiquidEngine41`)

Compacta 6 señales en 4 salidas + strobe:

```ts
frontPar  = frontRight           // Kick edge (envKick)
backPar   = backRight            // Snare (envSnare)
moverL    = moverLeft            // Treble cross-filter
moverR    = moverRight           // Vocal cross-filter
```

**Mapeo de zonas (routeZones):**
| Zona de salida | Valor | Notas |
|----------------|-------|-------|
| `frontLeft` / `frontRight` | `frontPar` | **Ambos lados son idénticos** — monocromo frontal |
| `backLeft` / `backRight` | `backPar` | **Ambos lados son idénticos** — monocromo trasero |
| `moverLeft` | `moverL` | Melodista / Lienzo L |
| `moverRight` | `moverR` | Alma / Lienzo R |
| `floor` | passthrough | Desde base |
| `ambient` | passthrough | Desde base (crushed) |
| `air` | passthrough | Desde base |

**Crítico:** En 4.1, `frontLeft === frontRight` y `backLeft === backRight`. No hay stereo real — es un rig compacto con PARs duplicados.

#### 7.1 — Setup Espacial (`LiquidEngine71`)

7 zonas independientes + 3 zonas ampliadas. **Stereo real.**

| Zona de salida | Valor | Fuente |
|----------------|-------|--------|
| `frontLeft` | `frontLeft` (envSubBass) | Océano — sub continuo |
| `frontRight` | `frontRight` (envKick) | Francotirador — bombo puro |
| `backLeft` | `backLeft` (envHighMid) | Coro / Tumbao |
| `backRight` | `backRight` (envSnare) | Látigo / TAcka |
| `moverLeft` | `outMoverL` | El Melodista (default) o El Galán (latino) |
| `moverRight` | `outMoverR` | El Alma (default) o La Dama (latino) |
| `floor` | passthrough | subBass+lowMid |
| `ambient` | passthrough | EMA crushed |
| `air` | passthrough | treble+highMid soft-compressed |

**Bifurcación por perfil (WAVE 2468 + 2470):**

| Perfil | Mover L | Mover R | PARs | Notas |
|--------|---------|---------|------|-------|
| **techno** (default) | `envTreble` | `envVocal` | Envelopes rítmicos | strict-split opcional |
| **latino** | `envVocal` (swap) | `envTreble` (swap) | Envelopes rítmicos | Asimétrico |
| **chill** | `envVocal` (La Voz del Mar) | `envTreble` (La Bioluminiscencia) | **Osciladores trigonométricos** | Sin strobe |

### 1.4 ¿Qué zonas están MUTEADAS o SUAVIZADAS?

| Zona | Estado | Raíz |
|------|--------|------|
| **ambient** | **ULTRA-MUTEADA por diseño** | `pow(x, 3.5)` + noise-gate 0.15. Una señal al 50% cae a ~8%. Necesita picos fuertes para brillar. |
| **air** | Suavizada | Soft-compression `1-e^(-x*3)` + EMA lenta. Nunca da latigazos. |
| **floor** | Reactiva | Directa de bands, solo atenuada por AGC recovery. |
| **flash** | No existe como zona L0 propia | El strobe se inyecta como evento binario sobre IMPACT nodes con shutter. |

**Conclusión operativa:** Si un fixture en `ambient` no "parpadea con el beat", es **por diseño**. El ambient está calibrado como wash de fondo ultra-lento. Si se desea que ambient pulse, hay que eliminar el cubic crush o bajar el noise-gate.

---

## 2. EL BUG DEL 127 (Default Values)

### 2.1 Hallazgo — Hardcodeo de 128 en rotation

El usuario reportó que un canal `rotation` ignora su `defaultValue` del JSON para arrancar en 127/128. La auditoría confirma **tres puntos de hardcodeo:**

#### Punto A: `src/hal/HardwareAbstraction.ts:2244`
```typescript
case 'rotation': return 128 // Stop
```
**Impacto:** Este es el fallback de hardware cuando no hay estado explícito. Si el fixture JSON dice `defaultValue: 0` (rotación parada en 0, o en otro valor según la convención del fabricante), el HAL fuerza 128.

#### Punto B: `src/hal/mapping/FixtureMapper.ts:597`
```typescript
case 'rotation':
  return state.phantomChannels?.['rotation'] ?? channel.defaultValue ?? 128  // Stop by default
```
**Impacto:** Si `channel.defaultValue` es `undefined` o `null`, cae a 128. Pero si el JSON **sí** tiene `defaultValue: 0`, debería respetarlo... **excepto** si el parser del JSON no está propagando `defaultValue` correctamente al `FixtureChannel`.

#### Punto C: `src/core/aether/ingestion/NodeExtractionPipeline.ts:1150-1151`
```typescript
if (kinetic && (type === 'pan' || type === 'tilt')) {
  return 128
}
```
**Impacto:** `rotation` NO está en esta lista, así que `_resolveDefaultValue` pasa al fallback `return 0`. Esto es inconsistente: un canal rotation en el pipeline Aether cae a 0, pero en el HAL cae a 128.

### 2.2 Análisis de la Convención DMX

Según el código (`FixtureMapper.ts:596`):
> "Continuous rotation: 0-127 CW, 128 stop, 129-255 CCW (convención DMX)"

Esto es una **convención de un fabricante específico** (probablemente Martin o Chauvet). No es universal:
- Algunos fixtures usan `0 = stop, 1-127 = CW, 128-255 = CCW`
- Algunos usan `0-127 = CCW, 128 = stop, 129-255 = CW`
- Algunos usan velocidad variable sin dirección explícita

**El hardcodeo a 128 asume una convención que puede no ser la del fixture cargado.**

### 2.3 Recomendación de Fix

1. **Eliminar** `case 'rotation': return 128` de `HardwareAbstraction.ts`.
2. **En `FixtureMapper.ts`**: cambiar `?? 128` por `?? channel.defaultValue ?? 0` (ya casi lo hace, pero verificar que `channel.defaultValue` llegue correctamente desde el parser).
3. **En `NodeExtractionPipeline.ts`**: si `rotation` requiere un default distinto de 0, añadirlo explícitamente respetando `ch.defaultValue` primero:
   ```typescript
   if (type === 'rotation') {
     return ch.defaultValue ?? 0  // o un valor configurable por perfil
   }
   ```

---

## 3. AUDITORÍA DE COLOR (Paletas y Morphs)

### 3.1 Pipeline Cromático L0/L1

```
SeleneLuxOutput.palette (RGB 0-255)
         │
         ├──► ColorAdapter (L1) ──► IIntentBus ──► NodeArbiter
         │       Mapeo: zona → rol cromático
         │       Roles: primary / secondary / accent / ambient
         │
         └──► SeleneAetherAdapter (L1) ──► IIntentBus
                 Overrides globales + por zona
                 _deriveAmbientColor() / _deriveAirColor()
```

### 3.2 Mapeo Zona → Rol Cromático

`selectColorRoleFromZone()` en `zoneUtils.ts:276`:

| Zona | Rol Cromático | Notas |
|------|---------------|-------|
| `front-left`, `front-right`, `front` | **primary** | Color dominante de la paleta |
| `back-left`, `back-right`, `back`, `left`, `right` | **secondary** | Color complementario |
| `movers-left` | **secondary** | Stereo mecánico |
| `movers-right` | **ambient** | Atenuado / wash |
| `ambient`, `air`, `floor` | **ambient** | Wash de fondo |
| (desconocida) | **ambient** | Fallback seguro |

### 3.3 ¿Todas las zonas comparten la misma paleta?

**NO.** La paleta se distribuye con **modificadores de zona**:

#### A. Zona `air` — Hue Shift (+60°)
`ColorAdapter.ts:271-276`:
```typescript
if (normalizeZoneId(node.zoneId ?? '') === 'air') {
  hueShiftRgb(rNorm, gNorm, bNorm, AIR_ZONE_HUE_OFFSET_DEG, this._hueShiftOut, 0.6)
}
```
- Los nodos COLOR en zona `air` reciben el color `ambient` de la paleta, **rotado 60° en el círculo cromático**.
- Saturación mínima forzada al 60% para evitar colores marrones.
- **Aplica solo a PARs/Ambient (no a movers).**

#### B. Zona `ambient` — Desaturación y Atenuación
`SeleneAetherAdapter._deriveAmbientColor()`:
- HSL: saturación ×0.58, luminosidad ×0.62
- RGB: cada canal ×0.62

#### C. Zona `air` — Desaturación + Shift de Matiz
`SeleneAetherAdapter._deriveAirColor()`:
- HSL: matiz +22°, saturación ×0.72, luminosidad ×0.66
- RGB: cada canal ×0.66

### 3.4 Restricción de Mood en Movers

`ColorAdapter` (WAVE 4775) mantiene un `_moverColorNodeIds`. Si un nodo COLOR está en ese Set:
- **NO** recibe el hue-shift de `air`.
- **NO** recibe las variaciones rápidas del Mood.
- Recibe la paleta constitucional directa de Selene (color estable).

Esto significa que los movers tienen **color fijo o de efectos (L3)**, mientras los PARs cambian con el Mood.

### 3.5 Interacción L0 (Intensidad) + L1 (Color)

| Capa | Canal | Qué envía | Merge en Arbiter |
|------|-------|-----------|------------------|
| **L0** | `brightness` | Intensidad zonal (zoneIntensity) | LTP puro (WAVE 4752) |
| **L1** | `r`, `g`, `b` | Color del rol | LTP puro |
| **L1** | `white`, `amber` | Tintes específicos | LTP puro |

El resultado visual = color L1 multiplicado por brightness L0 (en el resolver, brightness modula el valor final DMX de los canales de color).

---

## 4. DIFERENCIAS 4.1 vs 7.1 — Tabla Ejecutiva

| Aspecto | 4.1 | 7.1 |
|---------|-----|-----|
| **Zonas** | 4 + strobe | 7 + 3 ampliadas |
| **Stereo** | Mono (frontPar=both, backPar=both) | Stereo real (cada zona independiente) |
| **Front L** | = frontPar (kick) | = envSubBass (sub continuo) |
| **Front R** | = frontPar (kick) | = envKick (bombo puro) |
| **Movers** | Treble / Vocal | Treble/Vocal o Vocal/Treble (swap en latino/chill) |
| **PARs Chill** | Envelopes rítmicos | Osciladores trigonométricos (respiran) |
| **Strobe** | Activo según perfil | Activo según perfil |
| **Sidechain** | Inline (strict-split) | Guillotina general (post-envelope) |
| **Apocalypse** | No aplica | Sí (harshness + flatness → chaos) |
| **Uso recomendado** | Rigs < 8 fixtures, techno industrial | Rigs ≥ 8 fixtures, multi-género |

---

## 5. HALLAZGOS CRÍTICOS Y RECOMENDACIONES

### 🔴 CRÍTICO: Ambient está PETRIFICADO
El `ambientIntensity` pasa por `pow(x, 3.5)` con un noise-gate de 0.15. Esto significa que para que un fixture en zona `ambient` brille al 50%, la señal EMA debe estar en ~0.87 (87% del rango). En la práctica, `ambient` pasa la mayor parte del tiempo en **negro total** o en niveles muy bajos. Si el operador quiere que `ambient` sea un wash constante que pulse suavemente, se debe:
- Opción A: Reducir el exponente de `pow(x, 3.5)` a `pow(x, 2.0)` o `pow(x, 1.5)`.
- Opción B: Subir el noise-gate de 0.15 a 0.05 o eliminarlo.
- Opción C: Usar un `morphFactor` base más alto para elevar el `ambientMorphGain`.

### 🟡 MEDIO: Inconsistencia de defaults en rotation
`HardwareAbstraction` y `FixtureMapper` hardcodean 128. `NodeExtractionPipeline` cae a 0. Para fixtures donde `defaultValue=0` significa "rotación máxima CW", esto provoca comportamiento errático. La convención DMX de 128=stop no es universal.

### 🟢 INFORMATIVO: Air tiene carácter cromático propio
Los fixtures en zona `air` no solo son más tenues (×0.66), sino que su matiz está desplazado +60° (ColorAdapter) o +22° (SeleneAetherAdapter). Esto significa que si la paleta principal es azul, `air` será verde-cian. Si es rojo, `air` será naranja-ámbar.

---

## Anexos

### A. Código de referencia — Fuentes auditadas

| Módulo | Archivo | Líneas relevantes |
|--------|---------|-------------------|
| LiquidEngineBase | `src/hal/physics/LiquidEngineBase.ts` | 245-640 (applyBands), 680-733 (ambient generativo) |
| LiquidEngine41 | `src/hal/physics/LiquidEngine41.ts` | 36-93 (routeZones) |
| LiquidEngine71 | `src/hal/physics/LiquidEngine71.ts` | 71-241 (routeZones) |
| ColorAdapter | `src/core/aether/adapters/ColorAdapter.ts` | 240-293 (process) |
| SeleneAetherAdapter | `src/core/aether/adapters/selene-aether-adapter.ts` | 256-393 (color derivation) |
| ZoneUtils | `src/core/aether/adapters/zoneUtils.ts` | 173-301 (selectZoneFromResult, selectColorRoleFromZone) |
| NodeExtractionPipeline | `src/core/aether/ingestion/NodeExtractionPipeline.ts` | 1137-1161 (_resolveDefaultValue) |
| HardwareAbstraction | `src/hal/HardwareAbstraction.ts` | 2241-2246 (channel defaults) |
| FixtureMapper | `src/hal/mapping/FixtureMapper.ts` | 593-612 (rotation mapping) |

---
*Documento generado por Opus — WAVE 4810*
*Smart Gate L2: ✅ Operativo | Foco actual: Calibración artística L0*
