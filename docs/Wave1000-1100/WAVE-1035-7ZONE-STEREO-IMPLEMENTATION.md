# 🌊 WAVE 1035: 7-ZONE STEREO ARCHITECTURE

**Fecha**: 2026-01-29  
**Status**: ✅ IMPLEMENTADO (Piloto ChillLounge + Visual Feedback)  
**Dependencias**: WAVE 1034 (Bioluminescent Reef Audit)

---

## 📋 RESUMEN EJECUTIVO

Implementación de la arquitectura de **7 zonas estéreo** para ChillLounge como piloto.
Las burbujas bioluminiscentes ahora se mueven lateralmente entre fixtures izquierdos y derechos,
creando un efecto de **breathing lateral** visible en el escenario.

### FASES IMPLEMENTADAS

| Fase | Nombre | Status |
|------|--------|--------|
| **FASE 1** | Backend Physics | ✅ Completado |
| **FASE 2** | THE STEREO EYES | ✅ Completado |

### Zonas Implementadas

| Zona | Propósito | Fixtures |
|------|-----------|----------|
| `frontL` | Front Par izquierdo | PAR con position.x < 0 |
| `frontR` | Front Par derecho | PAR con position.x >= 0 |
| `backL` | Back Par izquierdo | PAR con position.x < 0 |
| `backR` | Back Par derecho | PAR con position.x >= 0 |
| `moverL` | Mover izquierdo | MOVING_LEFT |
| `moverR` | Mover derecho | MOVING_RIGHT |
| `air` | ⏳ DEFERRED | Lasers/Washers (no hardware) |

---

## 🏗️ ARQUITECTURA

### Data Flow

```
┌─────────────────────────┐
│  ChillStereoPhysics.ts  │
│  ────────────────────── │
│  processLightBubbles()  │
│    ↓                    │
│  Lane 0,1 → frontL      │
│  Lane 2,3 → frontR      │
│  Lane 0   → backL       │
│  Lane 3,4 → backR       │
└───────────┬─────────────┘
            │ zoneIntensities: { frontL, frontR, backL, backR, moverL, moverR }
            ▼
┌─────────────────────────┐
│      SeleneLux.ts       │
│  ────────────────────── │
│  chillOverrides: {      │
│    frontL, frontR,      │
│    backL, backR,        │
│    moverL, moverR       │
│  }                      │
│         ↓               │
│  chillStereoSplit → zoneIntensities output
└───────────┬─────────────┘
            │ zoneIntensities: { front, back, frontL, frontR, backL, backR, moverL, moverR }
            ▼
┌─────────────────────────┐
│     TitanEngine.ts      │
│  ────────────────────── │
│  if (hasChillStereo):   │
│    zones.frontL = ...   │
│    zones.frontR = ...   │
│    zones.backL = ...    │
│    zones.backR = ...    │
│  else:                  │
│    FALLBACK TO MONO     │
└───────────┬─────────────┘
            │ intent.zones: { frontL?, frontR?, backL?, backR?, front, back, left, right }
            ▼
┌─────────────────────────┐
│ HardwareAbstraction.ts  │
│  ────────────────────── │
│  if (hasChillStereo):   │
│    FRONT_PARS →         │
│      position.x < 0 ?   │
│        intent.frontL :  │
│        intent.frontR    │
│  else:                  │
│    LEGACY MONO          │
└─────────────────────────┘
```

---

## 📁 ARCHIVOS MODIFICADOS

### 1. `ChillStereoPhysics.ts`

**Cambios:**
- `ChillPhysicsResult.zoneIntensities` expandido con `frontL`, `frontR`, `backL`, `backR`
- `processLightBubbles()` actualizado para retornar 6 zonas estéreo
- Lane routing: Lanes 0-1 → izquierda, Lanes 2-4 → derecha
- `applyZones()` return statement actualizado

```typescript
// Nueva estructura de retorno
zoneIntensities: {
  front: number;     // Legacy mono (promedio)
  back: number;      // Legacy mono (promedio)
  mover: number;     // Legacy mono (promedio)
  frontL: number;    // 🌊 WAVE 1035
  frontR: number;    // 🌊 WAVE 1035
  backL: number;     // 🌊 WAVE 1035
  backR: number;     // 🌊 WAVE 1035
  moverL: number;    // Ya existente
  moverR: number;    // Ya existente
}
```

### 2. `LightingIntent.ts`

**Cambios:**
- `AbstractZone` expandido con nuevas zonas

```typescript
export type AbstractZone = 
  | 'front' | 'back' | 'left' | 'right' | 'ambient' | 'fill' | 'key'
  | 'frontLeft' | 'frontRight'     // 🌊 WAVE 1035
  | 'backLeft' | 'backRight'       // 🌊 WAVE 1035
  | 'frontL' | 'frontR'            // 🌊 WAVE 1035 (alias)
  | 'backL' | 'backR'              // 🌊 WAVE 1035 (alias)
  // ...
```

### 3. `SeleneLux.ts`

**Cambios:**
- `SeleneLuxOutput.zoneIntensities` interface expandido
- `chillOverrides` private type expandido
- Asignación de chillOverrides actualizada para extraer zonas estéreo
- Spread condicional `chillStereoSplit` agregado a output
- Cleanup de splits temporales

```typescript
// Nuevo output
zoneIntensities: {
  front: number;
  back: number;
  mover: number;
  moverL?: number;
  moverR?: number;
  frontL?: number;   // 🌊 WAVE 1035
  frontR?: number;   // 🌊 WAVE 1035
  backL?: number;    // 🌊 WAVE 1035
  backR?: number;    // 🌊 WAVE 1035
  laser: number;
  washer: number;
}
```

### 4. `TitanEngine.ts`

**Cambios:**
- Detección de `hasChillStereo` flag
- Construcción de `zones` con 7-zone mode si hay datos estéreo
- Fallback a legacy mono si no hay datos estéreo
- Log de debug cada 60 frames

```typescript
if (hasChillStereo) {
  // 7-ZONE MODE
  zones = {
    frontL: { intensity: frontL, paletteRole: 'primary' },
    frontR: { intensity: frontR, paletteRole: 'primary' },
    backL: { intensity: backL, paletteRole: 'accent' },
    backR: { intensity: backR, paletteRole: 'accent' },
    // ...
  };
} else {
  // LEGACY MONO
  zones = { front, back, left, right, ambient };
}
```

### 5. `HardwareAbstraction.ts`

**Cambios:**
- Detección de `hasChillStereo` basado en presencia de `intent.zones.frontL`
- Routing estéreo por posición X de fixture
- `FRONT_PARS` → `frontL` si `fixture.position.x < 0`, else `frontR`
- `BACK_PARS` → `backL` si `fixture.position.x < 0`, else `backR`
- Fallback a legacy mono si no hay datos estéreo

### 6. `FixtureMapper.ts`

**Cambios:**
- `PatchedFixture` interface expandido con `position?: { x, y, z }`

---

## 🔙 BACKWARD COMPATIBILITY

### Garantías

1. **Vibes Legacy (Techno/Rock/Latino)**: No afectados - continúan usando mono
2. **Shows existentes**: Funcionan sin cambios - fallback automático a mono
3. **Fixtures sin posición**: Fallback a zona mono tradicional

### Fallback Logic

```typescript
// Si no hay datos estéreo:
const frontL = ni.frontL ?? (ni.front ?? 0);  // Usa mono
const frontR = ni.frontR ?? (ni.front ?? 0);  // Usa mono

// Si fixture no tiene posición:
const fixtureX = fixture.position?.x ?? 0;    // Asume centro
```

---

## 🧪 TESTING

### Verificación Visual

Con música Chill activa y fixtures en posiciones L/R:

```
[AGC TRUST 🌊CHILL 7Z] FL:0.XX FR:0.YY | BL:0.XX BR:0.YY | ML:0.XX MR:0.YY
[TitanEngine 🌊] CHILL 7-ZONE: FL:XX% FR:YY% BL:XX% BR:YY%
```

### Esperado

- Los valores FL/FR deben diferir cuando las burbujas están en un lado
- El efecto visual debe mostrar "olas" moviéndose de izquierda a derecha
- Fixtures en `position.x < 0` deben seguir FL/BL
- Fixtures en `position.x >= 0` deben seguir FR/BR

---

## �️ FASE 2: THE STEREO EYES (Visual Feedback)

### StageGrid3D.tsx (Constructor 3D)

**Cambios:**
- Nueva función `getStereoZoneLabel()` que genera etiquetas con indicador Ⓛ/Ⓡ
- Al hacer hover/seleccionar un fixture, la etiqueta muestra:
  - `FRONT Ⓛ` o `FRONT Ⓡ` (basado en position.x)
  - `BACK Ⓛ` o `BACK Ⓡ` (basado en position.x)
  - `MOV Ⓛ` o `MOV Ⓡ` (por zona asignada)
- CSS añadido para `.label-zone` con estilo purple

**Resultado:** Cuando arrastras un fixture y cruza X=0, la etiqueta cambia de Ⓛ a Ⓡ.

### StageSimulator2.tsx (Simulador 2D)

**Cambios:**
- Línea central vertical (dashed, purple) que divide L/R
- Indicadores `Ⓛ LEFT` y `Ⓡ RIGHT` en la parte superior
- Labels de zona actualizados:
  - `FRONT Ⓛ` / `FRONT Ⓡ` en lugar de `FRONT PARS`
  - `BACK Ⓛ` / `BACK Ⓡ` en lugar de `BACK PARS`
  - `MOVING Ⓛ` / `MOVING Ⓡ` en lugar de `MOVING L/R`

**Resultado:** El simulador muestra visualmente la arquitectura estéreo.

---

## �🚀 NEXT STEPS

1. **WAVE 1036**: Testing en rig virtual con 12 fixtures
2. **WAVE 1037**: Extensión a Rock Physics (opcional)
3. **WAVE 1038**: AIR band implementation (requiere hardware)

---

## 📝 NOTAS

- **Performance**: Impacto mínimo - solo cálculos adicionales para Chill
- **Memory**: ~50 bytes extra por frame para splits temporales
- **Compilation**: Sin errores en archivos modificados

---

*WAVE 1035 - "The Lateral Breathing" + "The Stereo Eyes" - PunkOpus & Radwulf*
