# 🌬️ WAVE 284: GRAVITATIONAL RELAXATION

**Fecha:** 2026-01-01  
**Tipo:** Optimización Cromática  
**Análisis:** thermaldiversity.md  
**Filosofía:** No hardcodear salidas. Ajustar las fuerzas físicas.

---

## 📋 PROBLEMA DETECTADO

El análisis de logs reveló que la **Gravedad Térmica (35%)** era demasiado agresiva en TechnoClub:

```
[ThermalGravity] Hue: 135° (Verde) → 172° (Cyan)
```

**37 grados de migración** en un solo frame. Los colores satélite (Verdes Ácidos, Magentas, Violetas) estaban colapsando hacia el **agujero negro del Cyan** (polo frío 240°).

### Diversidad Perdida

- ❌ Verde Ácido → Cyan
- ❌ Violeta → Azul
- ❌ Magenta → Cyan-Magenta

Resultado: **Sopa de Cyan** en vez de diversidad cromática.

---

## 🔧 SOLUCIÓN: GRAVITATIONAL RELAXATION

### 1. Nueva Propiedad en GenerationOptions

```typescript
// SeleneColorEngine.ts
export interface GenerationOptions {
  // ... existing ...
  
  /**
   * 🌬️ WAVE 284: GRAVITATIONAL RELAXATION
   * 
   * Fuerza máxima de arrastre térmico (0.0 - 1.0).
   * @default 0.35 (legacy)
   */
  thermalGravityStrength?: number;
}
```

### 2. Función applyThermalGravity Modificada

```typescript
// ANTES
export function applyThermalGravity(hue: number, atmosphericTemp?: number): number {
  const MAX_THERMAL_FORCE = 0.35;  // HARDCODEADO
  // ...
}

// DESPUÉS (WAVE 284)
export function applyThermalGravity(
  hue: number, 
  atmosphericTemp?: number, 
  maxForce?: number
): number {
  const MAX_THERMAL_FORCE = maxForce ?? 0.35;  // CONFIGURABLE
  // ...
}
```

### 3. TECHNO_CONSTITUTION Actualizada

```typescript
export const TECHNO_CONSTITUTION: GenerationOptions = {
  atmosphericTemp: 9500,
  
  // 🌬️ WAVE 284: GRAVITATIONAL RELAXATION
  // ANTES: 0.35 (35%) - Muy agresivo
  //        Verde 135° → Cyan 172° (¡37° de migración!)
  // AHORA: 0.15 (15%) - Gravedad suave
  //        Verde 135° → Verde-Cian 142° (solo 7° de enfriamiento)
  thermalGravityStrength: 0.15,
  
  // ... resto igual ...
};
```

---

## 📐 MATEMÁTICA DEL CAMBIO

### Fórmula de Gravedad

```
resultHue = originalHue + (delta_to_pole × rawForce × MAX_THERMAL_FORCE)
```

### Cálculo para Verde 135° con TechnoClub (9500K):

**ANTES (35%):**
```
Polo = 240° (Azul)
Delta = 240 - 135 = 105°
rawForce = (9500 - 6200) / 2800 = 1.18 → clamped a 1.0
force = 1.0 × 0.35 = 35%
migración = 105 × 0.35 = 36.75°
resultado = 135 + 37 = 172° (Cyan) ❌
```

**DESPUÉS (15%):**
```
Polo = 240° (Azul)
Delta = 240 - 135 = 105°
rawForce = 1.0
force = 1.0 × 0.15 = 15%
migración = 105 × 0.15 = 15.75°
resultado = 135 + 16 = 151° (Verde-Cian) ✅
```

---

## 🛡️ RED DE SEGURIDAD INTACTA

| Protección | Estado | Función |
|------------|--------|---------|
| Rangos Prohibidos `[[25, 80]]` | ✅ Activo | Bloquea Naranja/Mostaza |
| elasticRotation: 15 | ✅ Activo | Escapa zonas prohibidas |
| atmosphericTemp: 9500 | ✅ Activo | Polo frío sigue atrayendo |
| hueRemapping | ✅ Activo | Verde césped → Verde láser |

---

## 🧪 LOG DE VERIFICACIÓN

Añadido log temporal para verificar diversidad:

```typescript
if (hue > 90 && hue < 150) {
  console.log(`[Gravity Check] 🟢 Green Input: ${hue}° → Result: ${resultHue}° | Force=${force}%`);
}
```

### Criterio de Éxito

```
[Gravity Check] 🟢 Green Input: 135° → Result: 142° | Force=15%
```

El verde debe **mantenerse verde**, solo enfriarse un poco hacia cyan, no convertirse en cyan puro.

---

## 📁 ARCHIVOS MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `SeleneColorEngine.ts` | +thermalGravityStrength en GenerationOptions, +parámetro en applyThermalGravity, +log de diversidad |
| `colorConstitutions.ts` | +thermalGravityStrength: 0.15 en TECHNO_CONSTITUTION |

---

## 🎯 RESULTADO ESPERADO

| Color Input | ANTES (35%) | DESPUÉS (15%) |
|-------------|-------------|---------------|
| Verde 120° | Cyan 165° | Verde-Cian 135° |
| Verde 135° | Cyan 172° | Verde-Cian 151° |
| Magenta 300° | Azul-Magenta 280° | Magenta 295° |
| Violeta 270° | Azul 260° | Violeta 265° |

**Visual:** Veremos Verde Ácido 🟢, Violeta 🟣 y Magenta 💜 en el escenario, no solo Cyan 🩵.

---

*"Los colores deben orbitar, no caer en el agujero negro"*  
— El Arquitecto, WAVE 284
